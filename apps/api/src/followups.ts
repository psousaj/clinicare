import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  anamneses, anamnesisProcedures, anamnesisVersions, appliedAnamneses, combos, comboItems,
  contracts, followupContracts, followupItems, followupSnapshots, followups,
  getDatabase, patients, plans, planVersionContracts, planVersionItems, planVersions, procedures,
  payments, signatureProcesses,
} from '@clinicare/db';

const idShape = (row: { id: string }) => ({ ...row, _id: row.id });
const notFound = (message: string) => Object.assign(new Error(message), { status: 404 });
const invalid = (message: string) => Object.assign(new Error(message), { status: 400 });
const latest = <T extends { version: number }>(rows: T[]) => rows.sort((a, b) => b.version - a.version)[0];
const terminal = (status: string) => status === 'completed' || status === 'cancelled';

type Offer = {
  name: string; priceCents: number; validUntil: Date | null; planVersionId: string | null;
  requireNewAnamnesis: boolean; items: Array<{ procedureId: string; procedureName: string; sessionsTotal: number; durationMinutes: number; priceCents: number; sessionSchema: unknown }>;
  snapshot: { kind: 'combo' | 'plan'; sourceVersion: number | null; payload: unknown };
  contracts: Array<{ contractId: string; contractVersion: number; title: string; contentSnapshot: string | null; sourceObjectKey: string | null }>;
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
  return {
    name: plan.name, priceCents: version.priceCents, validUntil: version.validityDays ? new Date(Date.now() + version.validityDays * 86400000) : null,
    planVersionId: version.id, requireNewAnamnesis: version.requireNewAnamnesis, items: itemRows.map((item: any) => ({ procedureId: item.procedureId, procedureName: item.procedureName, sessionsTotal: item.sessions, durationMinutes: item.durationMinutes, priceCents: item.priceCents, sessionSchema: item.sessionSchema })),
    snapshot: { kind: 'plan', sourceVersion: version.version, payload: { ...idShape(plan), version: { ...idShape(version), items: itemRows }, contracts: contractRows } },
    contracts: contractRows.map((contract: any) => ({ contractId: contract.contractId, contractVersion: contract.contractVersion, title: contract.title, contentSnapshot: contract.contentSnapshot, sourceObjectKey: contract.sourceObjectKey })),
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
    const followupId = crypto.randomUUID();
    const status = offerType === 'plan' ? 'idle' : 'active';
    const [created] = await tx.insert(followups).values({ id: followupId, tenantId, patientId, offerType, offerId, comboId: offerType === 'combo' ? offerId : null, planId: offerType === 'plan' ? offerId : null, planVersionId: offer.planVersionId, status, offerNameSnapshot: offer.name, priceCents: offer.priceCents, validUntil: offer.validUntil }).returning();
    if (options.failAfter === 'followup') throw new Error('Falha simulada na criação do acompanhamento.');
    await tx.insert(followupItems).values(offer.items.map((item) => ({ tenantId, followupId, ...item })));
    await tx.insert(followupSnapshots).values({ tenantId, followupId, kind: offer.snapshot.kind, sourceVersion: offer.snapshot.sourceVersion, payload: offer.snapshot.payload });
    if (offer.contracts.length) {
      const appliedContracts = await tx.insert(followupContracts).values(offer.contracts.map((contract) => ({ tenantId, followupId, contractId: contract.contractId, contractVersion: contract.contractVersion, titleSnapshot: contract.title, contentSnapshot: contract.contentSnapshot, sourceObjectKey: contract.sourceObjectKey })) as any).returning();
      await tx.insert(signatureProcesses).values(appliedContracts.map((contract: any) => ({
        tenantId,
        followupContractId: contract.id,
      })));
    }
    if (options.failAfter === 'items') throw new Error('Falha simulada na materialização do acompanhamento.');
    const forms = await offerForms(tenantId, offer, tx);
    if (forms.length) await tx.insert(appliedAnamneses).values(forms.map(({ form, version }: any) => ({ tenantId, patientId, followupId, anamnesisId: form.id, version: version.version, titleSnapshot: form.title, schemaSnapshot: version.schema, required: true })));
    if (options.failAfter === 'anamneses') throw new Error('Falha simulada nas dependências do acompanhamento.');
    return getFollowup(tenantId, followupId, tx);
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
  const responseItems = items.map((item: any) => ({ ...idShape(item), procedureId: item.procedureId, sessionsTotal: item.sessionsTotal, sessionsPerformed: item.sessionsPerformed }));
  const responseAnamneses = anamnesesRows.map((form: any) => ({ id: form.id, title: form.titleSnapshot, required: form.required, schemaSnapshot: form.schemaSnapshot, answered: !!form.submittedAt, submittedAt: form.submittedAt, validUntil: form.validUntil }));
  return { ...idShape(row), offerName: row.offerNameSnapshot, items: responseItems, contracts: contractsRows.map((contract: any) => ({ ...idShape(contract), title: contract.titleSnapshot, version: contract.contractVersion, signedAt: contract.patientSignedAt })), anamneses: responseAnamneses, payments: paymentRows, blocked: row.status === 'idle' || responseAnamneses.some((form: any) => form.required && !form.answered) };
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
    return getFollowup(tenantId, followupId, tx);
  });
}

export const cancelFollowup = (tenantId: string, followupId: string, reason: string) => updateFollowupState(tenantId, followupId, 'cancelled', reason);
