import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq, inArray } from 'drizzle-orm';
import { app } from './app';
import {
  appliedAnamneses, closeDatabase, contracts, contractVersions, followupContracts, followupItems, followupSnapshots, followups, getDatabase, migrateDatabase,
  patients, planVersionContracts, planVersionItems, planVersions, plans, procedures, signatureEvents,
  signatureParticipants, signatureProcesses, signatureRevisions, signatureTokens, tenants,
} from '@clinicare/db';

import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, integrationHeaders, provisionIntegrationClinic } from './integration-support';
let sessionHeaders: Record<string, string>;
const request = (path: string, init: RequestInit = {}) => app.request(path, { ...init, headers: { ...sessionHeaders, ...(init.headers ?? {}) } });
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { ...sessionHeaders }, body: JSON.stringify(body) });

integration('PostgreSQL signatures API', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  let patientId: string;
  let followupId: string;
  let patientTokens: string[];
  let professionalToken: string;
  let patientParticipantIds: string[];
  let professionalParticipantId: string;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    const db = getDatabase();
    await provisionIntegrationClinic(app, 'signatures', tenantId);
    await provisionIntegrationClinic(app, 'signatures-other', otherTenantId);
    sessionHeaders = integrationHeaders(tenantId);

    patientId = crypto.randomUUID();
    const procedureId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Paciente assinatura' });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento assinatura', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano assinatura' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 100 });
    await db.insert(planVersionItems).values({ tenantId, planVersionId: versionId, procedureId, sessions: 1, procedureName: 'Procedimento assinatura', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });

    const contractRows = [1, 2].map(() => ({ id: crypto.randomUUID(), versionId: crypto.randomUUID() }));
    for (const [index, row] of contractRows.entries()) {
      await db.insert(contracts).values({ id: row.id, tenantId, title: `Contrato obrigatório ${index + 1}`, kind: 'standard' });
      await db.insert(contractVersions).values({ id: row.versionId, tenantId, contractId: row.id, version: 1, content: `Conteúdo protegido ${index + 1}` });
      await db.insert(planVersionContracts).values({ tenantId, planVersionId: versionId, contractId: row.id, contractVersion: 1, title: `Contrato obrigatório ${index + 1}` });
    }

    const response = await request('/api/followups', { ...json({ patientId, offerType: 'plan', offerId: planId }), headers: sessionHeaders });
    expect(response.status).toBe(201);
    const created = await response.json() as any;
    followupId = created.id;
    const tokenGroups = Object.values(created.signatureTokens) as any[];
    patientTokens = tokenGroups.map((group) => group.patient.token);
    professionalToken = tokenGroups[0]!.professional.token;

    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    patientParticipantIds = participants.filter((participant) => participant.role === 'patient').map((participant) => participant.id);
    professionalParticipantId = participants.find((participant) => participant.role === 'professional')!.id;
    expect(patientParticipantIds).toHaveLength(2);
    expect(new Set(patientParticipantIds).size).toBe(2);
    expect(professionalParticipantId).toBeTruthy();
  });

  afterAll(async () => {
    const db = getDatabase();
    for (const table of [signatureEvents, signatureRevisions, signatureTokens, signatureParticipants, signatureProcesses, followupContracts, appliedAnamneses, followupItems, followupSnapshots, planVersionContracts, planVersionItems, followups, planVersions, plans, contractVersions, contracts, procedures, patients]) {
      await db.delete(table).where(eq((table as any).tenantId, tenantId));
    }
    await cleanupIntegrationClinics([tenantId, otherTenantId]);
    await closeDatabase();
  });

  it('reads encrypted applied content and keeps plaintext/token hashes out of storage', async () => {
    const read = await request(`/public/signatures/${patientTokens[0]}`);
    expect(read.status).toBe(200);
    const body = await read.json() as any;
    expect(['Conteúdo protegido 1', 'Conteúdo protegido 2']).toContain(body.contract.content);
    expect(JSON.stringify(body)).not.toContain('content_ciphertext');
    const db = getDatabase();
    const applied = await db.select().from(followupContracts).where(eq(followupContracts.tenantId, tenantId));
    expect(applied).toHaveLength(2);
    expect(applied.every((contract) => !!contract.contentCiphertext && !('contentSnapshot' in contract))).toBe(true);
    const storedTokens = await db.select().from(signatureTokens).where(eq(signatureTokens.tenantId, tenantId));
    const { createHash } = await import('node:crypto');
    expect(storedTokens.every((row) => row.tokenHash.length === 64 && !patientTokens.includes(row.tokenHash))).toBe(true);
    expect(storedTokens.filter((row) => row.participantId === patientParticipantIds[0]).map((row) => row.tokenHash)).toContain(createHash('sha256').update(patientTokens[0]!).digest('hex'));
    const revisions = await db.select().from(signatureRevisions).where(eq(signatureRevisions.tenantId, tenantId));
    expect(revisions).toHaveLength(0);
  });

  it('refreshes atomically and invalidates the old token', async () => {
    const refresh = await request(`/api/signature-participants/${patientParticipantIds[0]}/refresh`, { ...json({}), headers: sessionHeaders });
    expect(refresh.status).toBe(200);
    const refreshed = await refresh.json() as any;
    expect(refreshed.token).not.toBe(patientTokens[0]);
    expect((await request(`/public/signatures/${patientTokens[0]}`)).status).toBe(404);
    patientTokens[0] = refreshed.token;
  });

  it('allows pending professional signatures without blocking, activates after every patient contract, and deduplicates concurrent confirmation', async () => {
    const pending = await request('/api/signature-pending', { headers: { 'x-tenant-id': tenantId } });
    expect(pending.status).toBe(200);
    const pendingRows = await pending.json() as any[];
    expect(pendingRows.filter((row) => row.role === 'patient' && row.blocking)).toHaveLength(2);
    expect(pendingRows.filter((row) => row.role === 'professional' && !row.blocking)).toHaveLength(2);
    expect((await request(`/public/signatures/${professionalToken}`)).status).toBe(200);

    const firstConfirmations = await Promise.all([
      request(`/public/signatures/${patientTokens[0]}/confirm`, json({ evidence: { source: 'concurrent-a' } })),
      request(`/public/signatures/${patientTokens[0]}/confirm`, json({ evidence: { source: 'concurrent-b' } })),
    ]);
    expect(firstConfirmations.every((response) => response.status === 200)).toBe(true);
    expect((await (await request(`/api/followups/${followupId}`, { headers: { 'x-tenant-id': tenantId } })).json()).status).toBe('idle');

    const second = await request(`/public/signatures/${patientTokens[1]}/confirm`, json({ evidence: { source: 'second' } }));
    expect(second.status).toBe(200);
    expect((await second.json()).activated).toBe(true);
    const followup = await (await request(`/api/followups/${followupId}`, { headers: { 'x-tenant-id': tenantId } })).json() as any;
    expect(followup.status).toBe('active');
    const professionalConfirmation = await request(`/public/signatures/${professionalToken}/confirm`, json({ evidence: { source: 'clinic' } }));
    expect(professionalConfirmation.status).toBe(200);
    expect((await professionalConfirmation.json()).processCompleted).toBe(true);

    const db = getDatabase();
    const revisions = await db.select().from(signatureRevisions).where(eq(signatureRevisions.tenantId, tenantId));
    const events = await db.select().from(signatureEvents).where(eq(signatureEvents.tenantId, tenantId));
    expect(revisions).toHaveLength(3);
    expect(events.filter((event) => event.type === 'signed')).toHaveLength(3);
    expect(revisions.every((revision) => revision.evidenceCiphertext && !JSON.stringify(revision).includes('concurrent-a') && !JSON.stringify(revision).includes('concurrent-b') && !JSON.stringify(revision).includes('second') && !JSON.stringify(revision).includes('clinic'))).toBe(true);
  });

  it('rejects expired tokens and isolates tenant-scoped pending data', async () => {
    const db = getDatabase();
    const token = (await db.select().from(signatureTokens).where(and(eq(signatureTokens.tenantId, tenantId), eq(signatureTokens.participantId, professionalParticipantId))))[0]!;
    await db.update(signatureTokens).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(signatureTokens.id, token.id));
    expect((await request(`/public/signatures/${professionalToken}`)).status).toBe(404);
    expect((await request('/api/signature-pending', { headers: { ...integrationHeaders(otherTenantId) } })).status).toBe(200);
    expect(await (await request('/api/signature-pending', { headers: { ...integrationHeaders(otherTenantId) } })).json()).toEqual([]);
    expect((await request(`/api/followups/${followupId}`, { headers: integrationHeaders(otherTenantId) })).status).toBe(404);
  });
});
