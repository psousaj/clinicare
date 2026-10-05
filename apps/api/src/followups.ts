import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { paymentResponse } from './payments';
import {
  anamneses, anamnesisProcedures, anamnesisVersions, appliedAnamneses, combos, comboItems,
  contracts, contractVersions, followupContracts, followupItems, followupSnapshots, followups,
  getDatabase, patients, plans, planVersionContracts, planVersionItems, planVersions, procedures,
  payments, signatureProcesses, signatureParticipants, signatureTokens,
  buildProtectedAad, encryptValue,
} from '@clinicare/db';

const idShape = (row: { id: string }) => ({ ...row, _id: row.id });
const notFound = (message: string) => Object.assign(new Error(message), { status: 404 });
const invalid = (message: string) => Object.assign(new Error(message), { status: 400 });
const latest = <T extends { version: number }>(rows: T[]) => rows.sort((a, b) => b.version - a.version)[0];
const terminal = (status: string) => status === 'completed' || status === 'cancelled';
const validSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const validRenderedPdf = (version: any) => Boolean(version?.renderedPdfObjectKey && version.renderedPdfContentType === 'application/pdf' && validSha256(version.renderedPdfHash) && Number.isSafeInteger(version.renderedPdfSize) && version.renderedPdfSize > 0);

type Offer = {
  name: string; priceCents: number; validUntil: Date | null; planVersionId: string | null;
  requireNewAnamnesis: boolean; items: Array<{ procedureId: string; procedureName: string; sessionsTotal: number; durationMinutes: number; priceCents: number; sessionSchema: unknown }>;
  snapshot: { kind: 'combo' | 'plan'; sourceVersion: number | null; payload: unknown };
  contracts: Array<{ contractId: string; contractVersion: number; title: string; content: string | null; sourceObjectKey: string | null; renderedPdfObjectKey: string; renderedPdfHash: string; renderedPdfSize: number; renderedPdfContentType: string }>;
};
const protect = (tenantId: string, id: string, column: string, value: string | null) => value == null ? { contentCiphertext: null, contentNonce: null, contentKeyVersion: null } : (() => { const e = encryptValue(value, buildProtectedAad(tenantId, 'followup_contracts', id, column)); return { contentCiphertext: e.ciphertext, contentNonce: e.nonce, contentKeyVersion: e.keyVersion }; })();
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const issueInitialTokens = async (tx: any, tenantId: string, participantRows: any[]) => {
  const issued: Record<string, { patient?: any; professional?: any }> = {};
  for (const participant of participantRows) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await tx.insert(signatureTokens).values({ tenantId, participantId: participant.id, tokenHash: hashToken(token), expiresAt });
    const group = issued[participant.processId] ?? (issued[participant.processId] = {});
    group[participant.role as 'patient' | 'professional'] = { token, expiresAt, participantId: participant.id, url: `/public/signatures/${token}` };
  }
  return issued;
};

async function resolveOffer(tenantId: string, offerType: 'combo' | 'plan', offerId: string, executor: any): Promise<Offer> {
  if (offerType === 'combo') {
    const combo = (await executor.select().from(combos).where(and(eq(combos.tenantId, tenantId), eq(combos.id, offerId), eq(combos.active, true))))[0];
    if (!combo) throw notFound('Combo não encontrado.');
    const itemRows = await executor.select().from(comboItems).where(and(eq(comboItems.tenantId, tenantId), eq(comboItems.comboId, offerId)));
    const procedureRows = itemRows.length ? await executor.select().from(procedures).where(and(eq(procedures.tenantId, tenantId), inArray(procedures.id, itemRows.map((x: any) => x.procedureId)))) : [];
    if (!itemRows.length || procedureRows.length !== itemRows.length) throw invalid('Combo sem procedimentos disponíveis.');
    const items = itemRows.map((item: any) => { const procedure: any = procedureRows.find((p: any) => p.id === item.procedureId)!; return { procedureId: procedure.id, procedureName: procedure.name, sessionsTotal: item.sessions, durationMinutes: procedure.durationMinutes, priceCents: item.priceOverrideCents ?? procedure.priceCents, sessionSchema: procedure.sessionSchema }; });
    return { name: combo.name, priceCents: combo.promotionalPriceCents ?? combo.priceCents, validUntil: combo.validUntil, planVersionId: null, requireNewAnamnesis: combo.requireNewAnamnesis, items, snapshot: { kind: 'combo', sourceVersion: null, payload: { ...idShape(combo), items } }, contracts: [] };
  }
  const plan = (await executor.select().from(plans).where(and(eq(plans.tenantId, tenantId), eq(plans.id, offerId), eq(plans.active, true))))[0];
  if (!plan) throw notFound('Plano não encontrado.');
  const version = (await executor.select().from(planVersions).where(and(eq(planVersions.tenantId, tenantId), eq(planVersions.planId, offerId), eq(planVersions.version, plan.currentVersion))))[0];
  if (!version) throw notFound('Versão do plano não encontrada.');
  const itemRows = await executor.select().from(planVersionItems).where(and(eq(planVersionItems.tenantId, tenantId), eq(planVersionItems.planVersionId, version.id)));
  if (!itemRows.length) throw invalid('Plano sem procedimentos disponíveis.');
  const contractRows = await executor.select().from(planVersionContracts).where(and(eq(planVersionContracts.tenantId, tenantId), eq(planVersionContracts.planVersionId, version.id)));
  if (!contractRows.length) throw invalid('Plano sem contrato aplicável.');
  const contractIds = contractRows.map((row: any) => row.contractId);
  const contractContentRows = contractIds.length ? await executor.select().from(contractVersions).where(and(eq(contractVersions.tenantId, tenantId), inArray(contractVersions.contractId, contractIds))) : [];
  return {
    name: plan.name, priceCents: version.priceCents, validUntil: version.validityDays ? new Date(Date.now() + version.validityDays * 86400000) : null,
    planVersionId: version.id, requireNewAnamnesis: version.requireNewAnamnesis, items: itemRows.map((item: any) => ({ procedureId: item.procedureId, procedureName: item.procedureName, sessionsTotal: item.sessions, durationMinutes: item.durationMinutes, priceCents: item.priceCents, sessionSchema: item.sessionSchema })),
    snapshot: { kind: 'plan', sourceVersion: version.version, payload: { ...idShape(plan), version: { ...idShape(version), items: itemRows }, contracts: contractRows } },
    contracts: contractRows.map((contract: any) => { const version = contractContentRows.find((row: any) => row.contractId === contract.contractId && row.version === contract.contractVersion); if (!validRenderedPdf(version)) throw invalid('A versão do contrato não possui PDF renderizado verificado.'); return { contractId: contract.contractId, contractVersion: contract.contractVersion, title: contract.title, content: version.content ?? null, sourceObjectKey: contract.sourceObjectKey ?? version.sourceObjectKey ?? null, renderedPdfObjectKey: version.renderedPdfObjectKey, renderedPdfHash: version.renderedPdfHash, renderedPdfSize: version.renderedPdfSize, renderedPdfContentType: version.renderedPdfContentType }; }),
  };
}

async function offerForms(tenantId: string, offer: Offer, executor: any) {
  const links = offer.items.length ? await executor.select().from(anamnesisProcedures).where(and(eq(anamnesisProcedures.tenantId, tenantId), inArray(anamnesisProcedures.procedureId, offer.items.map((x) => x.procedureId)), eq(anamnesisProcedures.required, true))) : [];
  const ids = [...new Set(links.map((x: any) => x.anamnesisId))];
  const forms = ids.length ? await executor.select().from(anamneses).where(and(eq(anamneses.tenantId, tenantId), inArray(anamneses.id, ids as string[]), eq(anamneses.active, true)) as any) : [];
  const versions = ids.length ? await executor.select().from(anamnesisVersions).where(and(eq(anamnesisVersions.tenantId, tenantId), inArray(anamnesisVersions.anamnesisId, ids as string[])) as any) : [];
  return forms.map((form: any) => ({ form, version: latest(versions.filter((v: any) => v.anamnesisId === form.id)) })).filter((x: any) => x.version);
}

export async function createFollowup(tenantId: string, patientId: string, offerType: 'combo' | 'plan', offerId: string, options: { failAfter?: string } = {}) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const patient = (await tx.select({ id: patients.id }).from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId))))[0];
    if (!patient) throw notFound('Paciente não encontrado.');
    const offer = await resolveOffer(tenantId, offerType, offerId, tx);
    const followupId = randomUUID();
    const status = offerType === 'plan' ? 'idle' : 'active';
    const [created] = await tx.insert(followups).values({ id: followupId, tenantId, patientId, offerType, offerId, comboId: offerType === 'combo' ? offerId : null, planId: offerType === 'plan' ? offerId : null, planVersionId: offer.planVersionId, status, offerNameSnapshot: offer.name, priceCents: offer.priceCents, validUntil: offer.validUntil }).returning();
    if (options.failAfter === 'followup') throw new Error('Falha simulada na criação do acompanhamento.');
    await tx.insert(followupItems).values(offer.items.map((item) => ({ tenantId, followupId, ...item })));
    await tx.insert(followupSnapshots).values({ tenantId, followupId, kind: offer.snapshot.kind, sourceVersion: offer.snapshot.sourceVersion, payload: offer.snapshot.payload });
    let initialTokens: Record<string, { patient?: any; professional?: any }> = {};
    if (offer.contracts.length) {
      const appliedContracts = await tx.insert(followupContracts).values(offer.contracts.map((contract) => { const id = randomUUID(); const protectedContent = protect(tenantId, id, 'content', contract.content); return { id, tenantId, followupId, contractId: contract.contractId, contractVersion: contract.contractVersion, titleSnapshot: contract.title, ...protectedContent, sourceObjectKey: contract.sourceObjectKey, renderedPdfObjectKey: contract.renderedPdfObjectKey, renderedPdfHash: contract.renderedPdfHash, renderedPdfSize: contract.renderedPdfSize, renderedPdfContentType: contract.renderedPdfContentType }; }) as any).returning();
      const processes = await tx.insert(signatureProcesses).values(appliedContracts.map((contract: any) => ({ tenantId, followupContractId: contract.id }))).returning();
      const participants = await tx.insert(signatureParticipants).values(processes.flatMap((process: any) => [{ tenantId, processId: process.id, role: 'patient' }, { tenantId, processId: process.id, role: 'professional' }])).returning();
      initialTokens = await issueInitialTokens(tx, tenantId, participants);
    }
    if (options.failAfter === 'items') throw new Error('Falha simulada na materialização do acompanhamento.');
    const forms = await offerForms(tenantId, offer, tx);
    if (forms.length) await tx.insert(appliedAnamneses).values(forms.map(({ form, version }: any) => ({ tenantId, patientId, followupId, anamnesisId: form.id, version: version.version, titleSnapshot: form.title, schemaSnapshot: version.schema, validityMonths: form.validityMonths ?? 12, required: true })));
    if (options.failAfter === 'anamneses') throw new Error('Falha simulada nas dependências do acompanhamento.');
    const result = await getFollowup(tenantId, followupId, tx);
    return result ? { ...result, signatureTokens: initialTokens } : result;
  });
}

export async function getFollowup(tenantId: string, followupId: string, executor: any = getDatabase()) {
  const row = (await executor.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId))))[0];
  if (!row) return null;
  const [items, contractsRows, anamnesesRows, paymentRows] = await Promise.all([
    executor.select().from(followupItems).where(and(eq(followupItems.tenantId, tenantId), eq(followupItems.followupId, followupId))),
    executor.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.followupId, followupId))),
    executor.select().from(appliedAnamneses).where(and(eq(appliedAnamneses.tenantId, tenantId), eq(appliedAnamneses.followupId, followupId))),
    executor.select().from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.followupId, followupId))),
  ]);
  const processRows = contractsRows.length ? await executor.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), inArray(signatureProcesses.followupContractId, contractsRows.map((x: any) => x.id)))) : [];
  const participantRows = processRows.length ? await executor.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), inArray(signatureParticipants.processId, processRows.map((x: any) => x.id)))) : [];
  const responseItems = items.map((item: any) => ({ ...idShape(item), procedureId: item.procedureId, sessionsTotal: item.sessionsTotal, sessionsPerformed: item.sessionsPerformed }));
  const responseAnamneses = anamnesesRows.map((form: any) => ({ id: form.id, title: form.titleSnapshot, required: form.required, schemaSnapshot: form.schemaSnapshot, answered: !!form.submittedAt, submittedAt: form.submittedAt, validUntil: form.validUntil }));
  const responseContracts = contractsRows.map((contract: any) => { const process = processRows.find((p: any) => p.followupContractId === contract.id); const people = participantRows.filter((p: any) => p.processId === process?.id); const patient = people.find((p: any) => p.role === 'patient'); const professional = people.find((p: any) => p.role === 'professional'); return { id: contract.id, _id: contract.id, followupId: contract.followupId, contractId: contract.contractId, title: contract.titleSnapshot, version: contract.contractVersion, sourceObjectKey: contract.sourceObjectKey, required: contract.required, status: contract.status, signedAt: contract.patientSignedAt, patientSigned: patient?.status === 'signed', professionalSigned: professional?.status === 'signed', professionalPending: professional?.status !== 'signed' }; });
  return { ...idShape(row), offerName: row.offerNameSnapshot, items: responseItems, contracts: responseContracts, anamneses: responseAnamneses, payments: paymentRows.filter((payment: any) => !payment.deletedAt).map(paymentResponse), blocked: row.status === 'idle' || responseAnamneses.some((form: any) => form.required && !form.answered) };
}

export async function listFollowups(tenantId: string) {
  const rows = await getDatabase().select().from(followups).where(eq(followups.tenantId, tenantId)).orderBy(desc(followups.createdAt));
  return Promise.all(rows.map((row) => getFollowup(tenantId, row.id)));
}

export async function updateFollowupState(tenantId: string, followupId: string, status: 'completed' | 'cancelled', reason?: string) {
  if (status === 'cancelled' && !reason?.trim()) throw invalid('Motivo do cancelamento é obrigatório.');
  const db = getDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from followups where tenant_id = ${tenantId} and id = ${followupId} for update`);
    const existing = (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId))))[0];
    if (!existing) return null;
    if (terminal(existing.status)) throw Object.assign(new Error('Acompanhamento já encerrado.'), { status: 409 });
    if (status === 'completed') {
      const items = await tx.select().from(followupItems).where(and(eq(followupItems.tenantId, tenantId), eq(followupItems.followupId, followupId)));
      if (!items.length || items.some((item) => item.sessionsPerformed < item.sessionsTotal)) throw Object.assign(new Error('O acompanhamento só pode ser concluído quando todas as sessões forem realizadas.'), { status: 409 });
      await tx.update(followups).set({ status, completedAt: new Date(), updatedAt: new Date() }).where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId)));
    } else {
      await tx.update(followups).set({ status, cancellationReason: reason!.trim(), cancelledAt: new Date(), updatedAt: new Date() }).where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId)));
    }
    const applied = await tx.select({ process: signatureProcesses, contract: followupContracts }).from(signatureProcesses).innerJoin(followupContracts, and(eq(followupContracts.tenantId, signatureProcesses.tenantId), eq(followupContracts.id, signatureProcesses.followupContractId))).where(and(eq(signatureProcesses.tenantId, tenantId), eq(followupContracts.followupId, followupId)));
    for (const row of applied) {
      await tx.update(signatureTokens).set({ revokedAt: new Date() }).where(and(eq(signatureTokens.tenantId, tenantId), sql`${signatureTokens.participantId} in (select id from signature_participants where tenant_id = ${tenantId} and process_id = ${row.process.id})`));
      await tx.update(signatureProcesses).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, row.process.id), eq(signatureProcesses.status, 'pending')));
      await tx.update(followupContracts).set({ status: 'cancelled' }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, row.contract.id)));
    }
    return getFollowup(tenantId, followupId, tx);
  });
}

export const cancelFollowup = (tenantId: string, followupId: string, reason: string) => updateFollowupState(tenantId, followupId, 'cancelled', reason);
