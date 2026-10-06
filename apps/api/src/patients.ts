import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import {
  buildPatientAad,
  decryptValue,
  encryptValue,
  getDatabase,
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
  patients,
  patientPendingOperations,
  tenants,
  SEARCH_HMAC_KEY_VERSION,
  searchHmac,
  type RelationalPatient as PatientRow,
} from '@clinicare/db';

export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean { return UUID.test(value); }

export type PatientInput = { fullName?: unknown; email?: unknown; phone?: unknown; cpf?: unknown; birthDate?: unknown; notes?: unknown };

type ProtectedField = 'email' | 'phone' | 'cpf' | 'notes';

function encrypted(row: PatientRow, field: ProtectedField): string | null {
  const value = row[`${field}Ciphertext` as keyof PatientRow] as string | null;
  if (!value) return null;
  const nonce = row[`${field}Nonce` as keyof PatientRow] as string | null;
  const keyVersion = row[`${field}KeyVersion` as keyof PatientRow] as number | null;
  if (!nonce || !keyVersion) throw new Error(`Invalid encrypted patient ${field} value.`);
  return decryptValue({ ciphertext: value, nonce, keyVersion }, buildPatientAad(row.tenantId, row.id, field, keyVersion));
}

export function patientResponse(row: PatientRow, actorId?: string | null) {
  const canDecrypt = Boolean(actorId);
  return {
    _id: row.id,
    id: row.id,
    fullName: row.fullName,
    // Protected fields are deliberately null without the transitional actor context.
    email: canDecrypt ? encrypted(row, 'email') : null,
    phone: canDecrypt ? encrypted(row, 'phone') : null,
    cpf: canDecrypt ? encrypted(row, 'cpf') : null,
    notes: canDecrypt ? encrypted(row, 'notes') : null,
    birthDate: row.birthDate,
    active: !row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function validateInput(input: PatientInput, partial = false) {
  if (!partial && (typeof input.fullName !== 'string' || input.fullName.trim().length < 2)) throw new Error('Nome completo é obrigatório.');
  if (input.birthDate != null && (typeof input.birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) || Number.isNaN(new Date(`${input.birthDate}T00:00:00Z`).getTime()) || new Date(`${input.birthDate}T00:00:00Z`).toISOString().slice(0, 10) !== input.birthDate)) throw new Error('Data de nascimento inválida.');
  if (partial && input.fullName !== undefined && (typeof input.fullName !== 'string' || input.fullName.trim().length < 2)) throw new Error('Nome completo é obrigatório.');
  if (input.email != null && (typeof input.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(input.email) ?? ''))) throw new Error('E-mail inválido.');
  if (input.phone != null && typeof input.phone !== 'string') throw new Error('Telefone inválido.');
  if (input.cpf != null) normalizeCpf(input.cpf);
  if (input.notes != null && typeof input.notes !== 'string') throw new Error('Notas inválidas.');
}

function encryptedColumns(tenantId: string, id: string, input: PatientInput, fields: ProtectedField[] = ['email', 'phone', 'cpf', 'notes']) {
  void tenantId; void id;
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const value = field === 'email' ? normalizeEmail(input.email)
      : field === 'phone' ? normalizePhone(input.phone)
        : field === 'cpf' ? normalizeCpf(input.cpf)
          : typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim() : null;
    const encryptedValue = value == null ? null : encryptValue(value, buildPatientAad(tenantId, id, field));
    result[`${field}Ciphertext`] = encryptedValue?.ciphertext ?? null;
    result[`${field}Nonce`] = encryptedValue?.nonce ?? null;
    result[`${field}KeyVersion`] = encryptedValue?.keyVersion ?? null;
    if (field !== 'notes') {
      result[`${field}SearchHash`] = value == null ? null : searchHmac(tenantId, field, value);
      result[`${field}SearchKeyVersion`] = value == null ? null : SEARCH_HMAC_KEY_VERSION;
    }
  }
  return result;
}

async function ensureTenant(tenantId: string) {
  const [tenant] = await getDatabase().select({ id: tenants.id }).from(tenants).where(eq(tenants.id, tenantId));
  if (!tenant) throw new Error('Tenant não encontrado.');
}

export async function listPatients(tenantId: string, query?: string, actorId?: string | null) {
  const database = getDatabase();
  await ensureTenant(tenantId);
  const conditions = [eq(patients.tenantId, tenantId), isNull(patients.deletedAt)];
  const value = query?.trim();
  if (value) {
    const sensitive = [] as ReturnType<typeof eq>[];
    const email = normalizeEmail(value); if (email) sensitive.push(eq(patients.emailSearchHash, searchHmac(tenantId, 'email', email)));
    const phone = normalizePhone(value); if (phone) sensitive.push(eq(patients.phoneSearchHash, searchHmac(tenantId, 'phone', phone)));
    if (/^\d{11}$/.test(phone ?? '')) sensitive.push(eq(patients.cpfSearchHash, searchHmac(tenantId, 'cpf', phone!)));
    const search = [ilike(patients.fullName, `%${value}%`), ...sensitive];
    conditions.push(or(...search)!);
  }
  const rows = await database.select().from(patients).where(and(...conditions)).orderBy(desc(patients.createdAt));
  return rows.map((row) => patientResponse(row, actorId));
}

export async function getPatient(tenantId: string, id: string, actorId?: string | null) {
  if (!isUuid(id)) return null;
  const [row] = await getDatabase().select().from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.id, id), isNull(patients.deletedAt)));
  return row ? patientResponse(row, actorId) : null;
}

export async function createPatient(tenantId: string, input: PatientInput, actorId?: string | null) {
  validateInput(input);
  await ensureTenant(tenantId);
  const id = crypto.randomUUID();
  const [row] = await getDatabase().insert(patients).values({ tenantId, id, fullName: (input.fullName as string).trim(), birthDate: input.birthDate as string | null ?? null, ...encryptedColumns(tenantId, id, input) }).returning();
  return patientResponse(row, actorId);
}

export async function updatePatient(tenantId: string, id: string, input: PatientInput, actorId?: string | null) {
  if (!isUuid(id)) return null;
  validateInput(input, true);
  const database = getDatabase();
  const [existing] = await database.select().from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.id, id), isNull(patients.deletedAt)));
  if (!existing) return null;
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (input.fullName !== undefined) values.fullName = (input.fullName as string).trim();
  if (input.birthDate !== undefined) values.birthDate = input.birthDate as string | null;

  // Only encrypt fields explicitly present in a patch. This avoids decrypting
  // existing protected values merely to update an unrelated public field.
  const protectedFields = (['email', 'phone', 'cpf', 'notes'] as const).filter((field) => input[field] !== undefined);
  if (protectedFields.length) Object.assign(values, encryptedColumns(tenantId, id, input, [...protectedFields]));

  const [row] = await database.update(patients).set(values).where(and(eq(patients.tenantId, tenantId), eq(patients.id, id))).returning();
  return row ? patientResponse(row, actorId) : null;
}

export async function deactivatePatient(tenantId: string, id: string, actorId?: string | null) {
  if (!isUuid(id)) return null;
  const database = getDatabase();
  const [pending] = await database.select({ id: patientPendingOperations.id }).from(patientPendingOperations)
    .where(and(eq(patientPendingOperations.tenantId, tenantId), eq(patientPendingOperations.patientId, id), isNull(patientPendingOperations.resolvedAt))).limit(1);
  if (pending) return { conflict: 'Paciente possui operações pendentes; conclua-as antes de desativar.' } as const;
  const [row] = await database.update(patients).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(patients.tenantId, tenantId), eq(patients.id, id), isNull(patients.deletedAt))).returning();
  return row ? patientResponse(row, actorId) : null;
}
