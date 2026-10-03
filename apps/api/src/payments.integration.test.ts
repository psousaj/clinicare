import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq, isNull } from 'drizzle-orm';
import { app } from './app';
import { appliedAnamneses, anamneses, closeDatabase, comboItems, combos, followupItems, followupSnapshots, followups, getDatabase, patients, payments, procedures, tenants, migrateDatabase } from '@clinicare/db';

const integration = process.env.DATABASE_URL ? describe : describe.skip;

integration('PostgreSQL payments', () => {
  const tenantId = crypto.randomUUID();
  const headers = { 'content-type': 'application/json', 'x-tenant-id': tenantId };
  const post = (path: string, body: unknown, extra: Record<string, string> = {}) => app.request(path, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  const db = () => getDatabase();

  beforeAll(async () => {
    await migrateDatabase();
    await db().insert(tenants).values({ id: tenantId, name: `Payments ${tenantId}` });
  });
  afterAll(async () => {
    for (const table of [payments, appliedAnamneses, followupSnapshots, followupItems, comboItems, followups, combos, procedures, patients, anamneses]) await db().delete(table).where(eq((table as any).tenantId, tenantId));
    await db().delete(tenants).where(eq(tenants.id, tenantId));
    await closeDatabase();
  });

  async function fixture(priceCents = 1000) {
    const patientId = crypto.randomUUID(), procedureId = crypto.randomUUID(), comboId = crypto.randomUUID();
    await db().insert(patients).values({ id: patientId, tenantId, fullName: `Payment patient ${patientId}` });
    await db().insert(procedures).values({ id: procedureId, tenantId, name: `Payment procedure ${procedureId}`, durationMinutes: 30, priceCents, sessionSchema: { type: 'object', properties: {} } });
    await db().insert(combos).values({ id: comboId, tenantId, name: `Payment combo ${comboId}`, priceCents });
    await db().insert(comboItems).values({ tenantId, comboId, procedureId, sessions: 1 });
    const response = await post('/api/followups', { patientId, offerType: 'combo', offerId: comboId });
    expect(response.status).toBe(201);
    return (await response.json() as { id: string });
  }

  it('accepts idle, active, and completed followups with an outstanding balance', async () => {
    const idle = await fixture();
    const active = await fixture();
    const completed = await fixture();
    await db().update(followups).set({ status: 'active' }).where(eq(followups.id, active.id));
    await db().update(followups).set({ status: 'completed', completedAt: new Date() }).where(eq(followups.id, completed.id));
    for (const id of [idle.id, active.id, completed.id]) expect((await post('/api/payments', { followupId: id, amountCents: 100, method: 'pix' })).status).toBe(201);
  });

  it('is idempotent, rejects overpayment, and serializes concurrent attempts', async () => {
    const followup = await fixture(1000);
    const body = { followupId: followup.id, amountCents: 600, method: 'pix', idempotencyKey: 'payment-retry' };
    const first = await post('/api/payments', body);
    const retry = await post('/api/payments', body);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect((await retry.json()).id).toBe((await first.clone().json()).id);
    expect((await post('/api/payments', { ...body, idempotencyKey: 'different-key' })).status).toBe(409);
    const concurrent = await Promise.all([
      post('/api/payments', { followupId: followup.id, amountCents: 400, method: 'cash', idempotencyKey: 'concurrent-a' }),
      post('/api/payments', { followupId: followup.id, amountCents: 400, method: 'cash', idempotencyKey: 'concurrent-b' }),
    ]);
    expect(concurrent.filter((response) => response.status === 201)).toHaveLength(1);
    expect((await db().select().from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.followupId, followup.id), isNull(payments.deletedAt)))).reduce((sum, row) => sum + row.amountCents, 0)).toBe(1000);
  });

  it('includes applied anamneses in history and keeps payment notes tenant-scoped', async () => {
    const followup = await fixture(1000);
    const patientId = (await db().select({ id: followups.patientId }).from(followups).where(eq(followups.id, followup.id)))[0].id;
    const anamnesisId = crypto.randomUUID();
    await db().insert(anamneses).values({ id: anamnesisId, tenantId, title: 'Histórico', validityMonths: 12 });
    await db().insert(appliedAnamneses).values({ tenantId, patientId, followupId: followup.id, anamnesisId, version: 1, titleSnapshot: 'Histórico', schemaSnapshot: { type: 'object', properties: {} }, validUntil: new Date(Date.now() + 86400000) });
    const history = await (await app.request(`/api/patients/${patientId}/history`, { headers })).json() as any;
    expect(history.events.some((event: any) => event.type === 'anamnesis' && event.title.includes('pendente'))).toBe(true);
    const otherTenant = crypto.randomUUID();
    await db().insert(tenants).values({ id: otherTenant, name: `Other ${otherTenant}` });
    const hidden = await app.request(`/api/patients/${patientId}/history`, { headers: { ...headers, 'x-tenant-id': otherTenant } });
    expect(hidden.status).toBe(404);
    await db().delete(tenants).where(eq(tenants.id, otherTenant));
  });

  it('rejects cancelled followups and excludes soft-deleted payments from balance', async () => {
    const followup = await fixture(1000);
    await db().update(followups).set({ status: 'cancelled', cancelledAt: new Date(), cancellationReason: 'Solicitado' }).where(eq(followups.id, followup.id));
    expect((await post('/api/payments', { followupId: followup.id, amountCents: 100, method: 'cash' })).status).toBe(409);
    const usable = await fixture(1000);
    const payment = await (await post('/api/payments', { followupId: usable.id, amountCents: 1000, method: 'pix' })).json() as { id: string };
    expect((await app.request(`/api/payments/${payment.id}`, { method: 'DELETE', headers, body: JSON.stringify({ reason: 'Estorno registrado' }) })).status).toBe(200);
    expect((await post('/api/payments', { followupId: usable.id, amountCents: 1000, method: 'pix', idempotencyKey: 'after-delete' })).status).toBe(201);
  });
});
