import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  buildProtectedAad,
  decryptValue,
  encryptValue,
  followups,
  getDatabase,
  payments,
} from '@clinicare/db';

const invalid = (message: string) => Object.assign(new Error(message), { status: 400 });
const notFound = (message: string) => Object.assign(new Error(message), { status: 404 });
const conflict = (message: string) => Object.assign(new Error(message), { status: 409 });

export function paymentResponse(row: any) {
  let notes: string | null = null;
  if (row.notesCiphertext) {
    if (!row.notesNonce || !row.notesKeyVersion) throw new Error('Invalid encrypted payment notes value.');
    notes = decryptValue(
      { ciphertext: row.notesCiphertext, nonce: row.notesNonce, keyVersion: row.notesKeyVersion },
      buildProtectedAad(row.tenantId, 'payments', row.id, 'notes', row.notesKeyVersion),
    );
  }
  return {
    id: row.id,
    _id: row.id,
    followupId: row.followupId,
    amountCents: row.amountCents,
    method: row.method,
    installments: row.installments,
    receivedAt: row.receivedAt,
    notes,
    deletedAt: row.deletedAt,
    deletionReason: row.deletionReason,
    createdAt: row.createdAt,
  };
}

function protectedNotes(tenantId: string, id: string, value: unknown) {
  if (value == null || (typeof value === 'string' && !value.trim())) {
    return { notesCiphertext: null, notesNonce: null, notesKeyVersion: null };
  }
  if (typeof value !== 'string') throw invalid('Notas do pagamento inválidas.');
  const encrypted = encryptValue(value.trim(), buildProtectedAad(tenantId, 'payments', id, 'notes'));
  return { notesCiphertext: encrypted.ciphertext, notesNonce: encrypted.nonce, notesKeyVersion: encrypted.keyVersion };
}

async function readPayment(executor: any, tenantId: string, id: string) {
  const row = (await executor.select().from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.id, id), isNull(payments.deletedAt))))[0];
  return row ? paymentResponse(row) : null;
}

export type PaymentInput = {
  followupId: string;
  amountCents: number;
  method: 'cash' | 'pix' | 'credit_card';
  installments?: number;
  notes?: string | null;
  idempotencyKey?: string | null;
  receivedAt?: string | Date;
};

/**
 * Records a payment while holding the followup row lock. The balance is read
 * only after that lock, so concurrent requests cannot both spend the same
 * outstanding amount.
 */
export async function createPayment(tenantId: string, input: PaymentInput) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) throw invalid('Pagamento inválido.');
  if (!['cash', 'pix', 'credit_card'].includes(input.method)) throw invalid('Pagamento inválido.');
  const installments = input.installments ?? 1;
  if (!Number.isSafeInteger(installments) || installments < 1) throw invalid('Pagamento inválido.');
  const key = input.idempotencyKey?.trim() || null;
  if (key && key.length > 200) throw invalid('Chave de idempotência inválida.');

  return getDatabase().transaction(async (tx) => {
    // The followup lock is the serialization point for all payment attempts.
    const locked = await tx.execute(sql`select id, status, price_cents from followups where tenant_id = ${tenantId} and id = ${input.followupId} for update`);
    if (!locked.rows?.length) throw notFound('Acompanhamento não encontrado.');

    if (key) {
      const existing = (await tx.select().from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.idempotencyKey, key))).orderBy(desc(payments.createdAt)))[0];
      if (existing) {
        if (existing.followupId !== input.followupId || existing.amountCents !== input.amountCents || existing.method !== input.method || existing.installments !== installments) {
          throw conflict('A chave de idempotência já foi usada para outro pagamento.');
        }
        return paymentResponse(existing);
      }
    }

    const followup = locked.rows[0] as { status: string; price_cents: number };
    if (followup.status === 'cancelled') throw conflict('Acompanhamento cancelado não aceita pagamentos.');
    if (!['idle', 'active', 'completed'].includes(followup.status)) throw conflict('Estado do acompanhamento não aceita pagamentos.');

    const paidRows = await tx.select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)` }).from(payments).where(and(
      eq(payments.tenantId, tenantId), eq(payments.followupId, input.followupId), isNull(payments.deletedAt),
    ));
    const paidCents = Number(paidRows[0]?.total ?? 0);
    const balance = Number(followup.price_cents) - paidCents;
    if (balance <= 0) throw conflict('Acompanhamento não possui saldo disponível.');
    if (input.amountCents > balance) throw conflict('O pagamento excede o saldo disponível.');

    const id = crypto.randomUUID();
    const receivedAt = input.receivedAt instanceof Date ? input.receivedAt : input.receivedAt ? new Date(input.receivedAt) : new Date();
    if (!Number.isFinite(receivedAt.getTime())) throw invalid('Data do pagamento inválida.');
    const [created] = await tx.insert(payments).values({
      id, tenantId, followupId: input.followupId, amountCents: input.amountCents, method: input.method,
      installments, receivedAt, idempotencyKey: key, ...protectedNotes(tenantId, id, input.notes),
    }).returning();
    return paymentResponse(created);
  });
}

export async function deletePayment(tenantId: string, id: string, reason: string) {
  if (!reason.trim()) throw invalid('Motivo da exclusão é obrigatório.');
  return getDatabase().transaction(async (tx) => {
    const payment = (await tx.select({ followupId: payments.followupId }).from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.id, id)))).at(0);
    if (!payment) return null;
    await tx.execute(sql`select id from followups where tenant_id = ${tenantId} and id = ${payment.followupId} for update`);
    const row = (await tx.select().from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.id, id)))).at(0);
    if (!row) return null;
    if (row.deletedAt) return paymentResponse(row);
    const [updated] = await tx.update(payments).set({ deletedAt: new Date(), deletionReason: reason.trim() }).where(and(eq(payments.tenantId, tenantId), eq(payments.id, id), isNull(payments.deletedAt))).returning();
    return paymentResponse(updated ?? row);
  });
}

export async function listPayments(tenantId: string, followupId: string) {
  const rows = await getDatabase().select().from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.followupId, followupId), isNull(payments.deletedAt))).orderBy(desc(payments.receivedAt));
  return rows.map(paymentResponse);
}
