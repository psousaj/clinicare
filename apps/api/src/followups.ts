import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { paymentResponse } from './payments';
import {
  anamneses, anamnesisProcedures, anamnesisVersions, appliedAnamneses, comboAnamneses, combos, comboItems, eventAnamneses, eventContracts, eventItems, events, planVersionAnamneses,
  contracts, contractVersions, followupContracts, followupItems, followupSnapshots, followups,
  getDatabase, patients, plans, planVersionContracts, planVersionItems, planVersions, procedures,
  payments, signatureEvents, signatureProcesses, signatureParticipants, signatureTokens,
  buildPatientAad, buildProtectedAad, decryptValue, encryptValue, normalizePhone,
} from '@clinicare/db';

const idShape = (row: { id: string }) => ({ ...row, _id: row.id });
const notFound = (message: string) => Object.assign(new Error(message), { status: 404 });
const invalid = (message: string) => Object.assign(new Error(message), { status: 400 });
const latest = <T extends { version: number }>(rows: T[]) => rows.sort((a, b) => b.version - a.version)[0];
const terminal = (status: string) => status === 'completed' || status === 'cancelled';
const validSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const validRenderedPdf = (version: any) => Boolean(version?.renderedPdfObjectKey && version.renderedPdfContentType === 'application/pdf' && validSha256(version.renderedPdfHash) && Number.isSafeInteger(version.renderedPdfSize) && version.renderedPdfSize > 0);
const validCivilDate = (value: unknown): value is string => value == null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value);

type Offer = {
  name: string; priceCents: number; validUntil: Date | null; planVersionId: string | null;
  requireNewAnamnesis: boolean; comboId?: string | null; eventId?: string | null; eventDate?: string | null;
  items: Array<{ procedureId: string; procedureName: string; sessionsTotal: number; durationMinutes: number; priceCents: number; sessionSchema: unknown; comboId?: string | null; comboName?: string | null; packagePriceCents?: number | null }>;
  snapshot: { kind: 'combo' | 'plan' | 'event'; sourceVersion: number | null; payload: unknown };
  contracts: Array<{ contractId: string; contractVersion: number; title: string; content: string | null; sourceObjectKey: string | null; sourceDocxObjectKey: string | null; contextConfiguration: unknown; allowedPlaceholders: unknown; requiredPlaceholders: unknown; renderedPdfObjectKey: string | null; renderedPdfHash: string | null; renderedPdfSize: number | null; renderedPdfContentType: string | null }>;
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

type EventChoice = { kind: 'procedure'; procedureId: string } | { kind: 'combo'; comboId: string };
type ContractRef = { contractId: string; title: string; sourceObjectKey?: string | null };

// A versão publicada corrente de cada contrato modelo é resolvida e congelada na aplicação (plano ou evento).
async function resolveAppliedContracts(tenantId: string, contractRows: ContractRef[], executor: any): Promise<Offer['contracts']> {
  const contractIds = contractRows.map((row) => row.contractId);
  const contractContentRows = contractIds.length ? await executor.select().from(contractVersions).where(and(eq(contractVersions.tenantId, tenantId), inArray(contractVersions.contractId, contractIds), sql`${contractVersions.version} = (select max(cv.version) from contract_versions cv where cv.tenant_id = ${tenantId} and cv.contract_id = ${contractVersions.contractId})`)).orderBy(desc(contractVersions.version)) : [];
  return contractRows.map((contract) => { const version = contractContentRows.find((row: any) => row.contractId === contract.contractId); if (!version || (!version.sourceDocxObjectKey && !validRenderedPdf(version))) throw invalid('A versão publicada do contrato não possui fonte DOCX ou PDF verificável.'); return { contractId: contract.contractId, contractVersion: version.version, title: contract.title, content: version.content ?? null, sourceObjectKey: contract.sourceObjectKey ?? version.sourceObjectKey ?? null, sourceDocxObjectKey: version.sourceDocxObjectKey ?? null, contextConfiguration: version.contextConfiguration, allowedPlaceholders: version.allowedPlaceholders, requiredPlaceholders: version.requiredPlaceholders, renderedPdfObjectKey: version.renderedPdfObjectKey ?? null, renderedPdfHash: version.renderedPdfHash ?? null, renderedPdfSize: version.renderedPdfSize ?? null, renderedPdfContentType: version.renderedPdfContentType ?? null }; });
}

// Evento: valida a escolha do paciente contra o cardápio e congela itens, preços e contratos. Combo escolhido entra fechado.
async function resolveEvent(tenantId: string, eventId: string, choice: unknown, executor: any): Promise<Offer> {
  await executor.execute(sql`select id from events where tenant_id = ${tenantId} and id = ${eventId} for share`);
  const event = (await executor.select().from(events).where(and(eq(events.tenantId, tenantId), eq(events.id, eventId), eq(events.active, true))))[0];
  if (!event) throw notFound('Evento não encontrado.');
  if (!Array.isArray(choice) || !choice.length) throw invalid('Escolha ao menos um item do cardápio do evento.');
  const picks: EventChoice[] = choice.map((entry: any) => {
    if (entry?.kind === 'procedure' && typeof entry.procedureId === 'string') return { kind: 'procedure', procedureId: entry.procedureId };
    if (entry?.kind === 'combo' && typeof entry.comboId === 'string') return { kind: 'combo', comboId: entry.comboId };
    throw invalid('Escolha do evento inválida.');
  });
  if (new Set(picks.map((pick) => pick.kind === 'procedure' ? `p:${pick.procedureId}` : `c:${pick.comboId}`)).size !== picks.length) throw invalid('Escolha do evento não aceita item repetido.');
  const menu = await executor.select().from(eventItems).where(and(eq(eventItems.tenantId, tenantId), eq(eventItems.eventId, eventId)));
  const inMenu = (pick: EventChoice) => menu.find((item: any) => pick.kind === 'procedure' ? item.kind === 'procedure' && item.procedureId === pick.procedureId : item.kind === 'combo' && item.comboId === pick.comboId);
  if (picks.some((pick) => !inMenu(pick))) throw invalid('Escolha do evento fora do cardápio.');
  const comboIds = picks.filter((pick): pick is Extract<EventChoice, { kind: 'combo' }> => pick.kind === 'combo').map((pick) => pick.comboId);
  const comboRows = comboIds.length ? await executor.select().from(combos).where(and(eq(combos.tenantId, tenantId), inArray(combos.id, comboIds))) : [];
  const comboItemRows = comboIds.length ? await executor.select().from(comboItems).where(and(eq(comboItems.tenantId, tenantId), inArray(comboItems.comboId, comboIds))) : [];
  const procedureIds = [...new Set([...picks.filter((pick) => pick.kind === 'procedure').map((pick: any) => pick.procedureId), ...comboItemRows.map((row: any) => row.procedureId)])];
  const procedureRows = procedureIds.length ? await executor.select().from(procedures).where(and(eq(procedures.tenantId, tenantId), inArray(procedures.id, procedureIds))) : [];
  const procedureOf = (id: string) => procedureRows.find((row: any) => row.id === id);
  const now = new Date();
  for (const id of comboIds) {
    const combo = comboRows.find((row: any) => row.id === id);
    if (!combo || !combo.active) throw invalid('Combo do evento indisponível.');
    if ((combo.validFrom && combo.validFrom > now) || (combo.validUntil && combo.validUntil < now)) throw invalid('Combo do evento fora da vigência.');
    const rows = comboItemRows.filter((row: any) => row.comboId === id);
    if (!rows.length || rows.some((row: any) => !procedureOf(row.procedureId)?.active)) throw invalid('Combo do evento sem procedimentos disponíveis.');
  }
  const comboProcedureIds = new Set(comboItemRows.map((row: any) => row.procedureId));
  const items: Offer['items'] = [];
  for (const pick of picks) {
    if (pick.kind === 'procedure') {
      const procedure = procedureOf(pick.procedureId);
      if (!procedure?.active) throw invalid('Procedimento do evento indisponível.');
      if (comboProcedureIds.has(pick.procedureId)) throw invalid('Procedimento já incluído em um combo escolhido; escolha apenas um dos dois.');
      items.push({ procedureId: procedure.id, procedureName: procedure.name, sessionsTotal: inMenu(pick).sessions, durationMinutes: procedure.durationMinutes, priceCents: procedure.priceCents, sessionSchema: procedure.sessionSchema });
    } else {
      const combo = comboRows.find((row: any) => row.id === pick.comboId)!;
      const packagePriceCents = combo.promotionalPriceCents ?? combo.priceCents;
      for (const row of comboItemRows.filter((entry: any) => entry.comboId === combo.id)) {
        const procedure = procedureOf(row.procedureId)!;
        items.push({ procedureId: procedure.id, procedureName: procedure.name, sessionsTotal: row.sessions, durationMinutes: procedure.durationMinutes, priceCents: row.priceOverrideCents ?? procedure.priceCents, sessionSchema: procedure.sessionSchema, comboId: combo.id, comboName: combo.name, packagePriceCents });
      }
    }
  }
  const contractRows = await executor.select().from(eventContracts).where(and(eq(eventContracts.tenantId, tenantId), eq(eventContracts.eventId, eventId))).orderBy(eventContracts.contractId);
  if (!contractRows.length) throw invalid('Evento sem contrato aplicável.');
  return {
    name: event.name, priceCents: 0, validUntil: null, planVersionId: null, requireNewAnamnesis: false, eventId: event.id, eventDate: event.eventDate, items,
    snapshot: { kind: 'event', sourceVersion: null, payload: { ...idShape(event), menu, choice: picks, items } },
    contracts: await resolveAppliedContracts(tenantId, contractRows, executor),
  };
}

async function resolveOffer(tenantId: string, offerType: 'combo' | 'plan' | 'event', offerId: string, executor: any, choice?: unknown): Promise<Offer> {
  if (offerType === 'event') return resolveEvent(tenantId, offerId, choice, executor);
  if (offerType === 'combo') {
    const combo = (await executor.select().from(combos).where(and(eq(combos.tenantId, tenantId), eq(combos.id, offerId), eq(combos.active, true))))[0];
    if (!combo) throw notFound('Combo não encontrado.');
    const itemRows = await executor.select().from(comboItems).where(and(eq(comboItems.tenantId, tenantId), eq(comboItems.comboId, offerId)));
    const procedureRows = itemRows.length ? await executor.select().from(procedures).where(and(eq(procedures.tenantId, tenantId), inArray(procedures.id, itemRows.map((x: any) => x.procedureId)))) : [];
    if (!itemRows.length || procedureRows.length !== itemRows.length) throw invalid('Combo sem procedimentos disponíveis.');
    const items = itemRows.map((item: any) => { const procedure: any = procedureRows.find((p: any) => p.id === item.procedureId)!; return { procedureId: procedure.id, procedureName: procedure.name, sessionsTotal: item.sessions, durationMinutes: procedure.durationMinutes, priceCents: item.priceOverrideCents ?? procedure.priceCents, sessionSchema: procedure.sessionSchema }; });
    return { name: combo.name, priceCents: combo.promotionalPriceCents ?? combo.priceCents, validUntil: combo.validUntil, planVersionId: null, comboId: offerId, requireNewAnamnesis: combo.requireNewAnamnesis, items, snapshot: { kind: 'combo', sourceVersion: null, payload: { ...idShape(combo), items } }, contracts: [] };
  }
  await executor.execute(sql`select id from plans where tenant_id = ${tenantId} and id = ${offerId} for share`);
  const plan = (await executor.select().from(plans).where(and(eq(plans.tenantId, tenantId), eq(plans.id, offerId), eq(plans.active, true))))[0];
  if (!plan) throw notFound('Plano não encontrado.');
  const version = (await executor.select().from(planVersions).where(and(eq(planVersions.tenantId, tenantId), eq(planVersions.planId, offerId), eq(planVersions.version, plan.currentVersion))))[0];
  if (!version) throw notFound('Versão do plano não encontrada.');
  const itemRows = await executor.select().from(planVersionItems).where(and(eq(planVersionItems.tenantId, tenantId), eq(planVersionItems.planVersionId, version.id)));
  if (!itemRows.length) throw invalid('Plano sem procedimentos disponíveis.');
  // Itens de combo expandem em itens de acompanhamento por procedimento (flat); a origem fica no snapshot da versão.
  const comboItemsOf = (item: any): any[] => item.comboSnapshot?.items ?? [];
  if (itemRows.some((item: any) => item.offerType === 'combo' && !comboItemsOf(item).length)) throw invalid('Plano sem procedimentos disponíveis.');
  const expandedItems = itemRows.flatMap((item: any) => item.offerType === 'combo'
    ? comboItemsOf(item).map((comboItem) => ({ procedureId: comboItem.procedureId, procedureName: comboItem.procedureName, sessionsTotal: comboItem.sessions, durationMinutes: comboItem.durationMinutes, priceCents: comboItem.priceCents, sessionSchema: comboItem.sessionSchema }))
    : [{ procedureId: item.procedureId, procedureName: item.procedureName, sessionsTotal: item.sessions, durationMinutes: item.durationMinutes, priceCents: item.priceCents, sessionSchema: item.sessionSchema }]);
  const contractRows = await executor.select().from(planVersionContracts).where(and(eq(planVersionContracts.tenantId, tenantId), eq(planVersionContracts.planVersionId, version.id))).orderBy(planVersionContracts.contractId);
  if (!contractRows.length) throw invalid('Plano sem contrato aplicável.');
  return {
    name: plan.name, priceCents: version.priceCents, validUntil: version.validityDays ? new Date(Date.now() + version.validityDays * 86400000) : null,
    planVersionId: version.id, requireNewAnamnesis: version.requireNewAnamnesis, items: expandedItems,
    snapshot: { kind: 'plan', sourceVersion: version.version, payload: { ...idShape(plan), version: { ...idShape(version), items: itemRows }, contracts: contractRows } },
    contracts: await resolveAppliedContracts(tenantId, contractRows, executor),
  };
}

// Anamneses da inscrição: união das vinculadas na própria oferta (combo, versão de plano ou evento) com as dos procedimentos — igual aos contratos.
async function offerForms(tenantId: string, offer: Offer, executor: any) {
  const owned: string[] = [];
  if (offer.comboId) owned.push(...(await executor.select({ anamnesisId: comboAnamneses.anamnesisId }).from(comboAnamneses).where(and(eq(comboAnamneses.tenantId, tenantId), eq(comboAnamneses.comboId, offer.comboId), eq(comboAnamneses.required, true)))).map((row: any) => row.anamnesisId));
  if (offer.planVersionId) owned.push(...(await executor.select({ anamnesisId: planVersionAnamneses.anamnesisId }).from(planVersionAnamneses).where(and(eq(planVersionAnamneses.tenantId, tenantId), eq(planVersionAnamneses.planVersionId, offer.planVersionId), eq(planVersionAnamneses.required, true)))).map((row: any) => row.anamnesisId));
  if (offer.eventId) owned.push(...(await executor.select({ anamnesisId: eventAnamneses.anamnesisId }).from(eventAnamneses).where(and(eq(eventAnamneses.tenantId, tenantId), eq(eventAnamneses.eventId, offer.eventId), eq(eventAnamneses.required, true)))).map((row: any) => row.anamnesisId));
  const links = offer.items.length ? await executor.select().from(anamnesisProcedures).where(and(eq(anamnesisProcedures.tenantId, tenantId), inArray(anamnesisProcedures.procedureId, offer.items.map((x) => x.procedureId)), eq(anamnesisProcedures.required, true))) : [];
  const ids = [...new Set([...owned, ...links.map((x: any) => x.anamnesisId)])];
  const forms = ids.length ? await executor.select().from(anamneses).where(and(eq(anamneses.tenantId, tenantId), inArray(anamneses.id, ids as string[]), eq(anamneses.active, true)) as any) : [];
  const versions = ids.length ? await executor.select().from(anamnesisVersions).where(and(eq(anamnesisVersions.tenantId, tenantId), inArray(anamnesisVersions.anamnesisId, ids as string[])) as any) : [];
  return forms.map((form: any) => ({ form, version: latest(versions.filter((v: any) => v.anamnesisId === form.id)) })).filter((x: any) => x.version);
}

export async function createFollowup(tenantId: string, patientId: string, offerType: 'combo' | 'plan' | 'event', offerId: string, options: { failAfter?: string; contractApplicationDate?: string | null; choice?: unknown } = {}) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const patient = (await tx.select().from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId))))[0];
    if (!patient) throw notFound('Paciente não encontrado.');
    const offer = await resolveOffer(tenantId, offerType, offerId, tx, options.choice);
    let patientPhone: string | null = null;
    if (offer.contracts.length) {
      if (!patient.phoneCiphertext || !patient.phoneNonce || !patient.phoneKeyVersion) throw invalid('Paciente precisa ter telefone cadastrado para assinar o contrato.');
      patientPhone = normalizePhone(decryptValue({ ciphertext: patient.phoneCiphertext, nonce: patient.phoneNonce, keyVersion: patient.phoneKeyVersion }, buildPatientAad(tenantId, patient.id, 'phone', patient.phoneKeyVersion)));
      if (!patientPhone) throw invalid('Paciente precisa ter telefone cadastrado para assinar o contrato.');
    }
    const followupId = randomUUID();
    if (!validCivilDate(options.contractApplicationDate)) throw invalid('Data de aplicação do contrato inválida.');
    // Plano e evento nascem ociosos até a assinatura do paciente; combo entra ativo.
    const status = offerType === 'combo' ? 'active' : 'idle';
    const [created] = await tx.insert(followups).values({ id: followupId, tenantId, patientId, offerType, offerId, comboId: offerType === 'combo' ? offerId : null, planId: offerType === 'plan' ? offerId : null, planVersionId: offer.planVersionId, eventId: offer.eventId ?? null, eventDate: offer.eventDate ?? null, status, contractApplicationDate: offerType === 'combo' ? null : options.contractApplicationDate ?? offer.eventDate ?? null, offerNameSnapshot: offer.name, priceCents: offer.priceCents, validUntil: offer.validUntil }).returning();
    if (options.failAfter === 'followup') throw new Error('Falha simulada na criação do acompanhamento.');
    await tx.insert(followupItems).values(offer.items.map((item) => ({ tenantId, followupId, ...item })));
    await tx.insert(followupSnapshots).values({ tenantId, followupId, kind: offer.snapshot.kind, sourceVersion: offer.snapshot.sourceVersion, payload: offer.snapshot.payload });
    let initialTokens: Record<string, { patient?: any; professional?: any }> = {};
    if (offer.contracts.length) {
      const appliedContracts = await tx.insert(followupContracts).values(offer.contracts.map((contract) => { const id = randomUUID(); const protectedContent = protect(tenantId, id, 'content', contract.content); return { id, tenantId, followupId, contractId: contract.contractId, contractVersion: contract.contractVersion, titleSnapshot: contract.title, ...protectedContent, sourceObjectKey: contract.sourceObjectKey, renderedPdfObjectKey: contract.renderedPdfObjectKey, renderedPdfHash: contract.renderedPdfHash, renderedPdfSize: contract.renderedPdfSize, renderedPdfContentType: contract.renderedPdfContentType, status: contract.sourceDocxObjectKey ? 'generating' : 'pending' }; }) as any).returning();
      // Contratos DOCX nascem como 'generating' (materialização assíncrona cria os
      // processos de assinatura depois); sem contratos 'pending' não há o que inserir.
      const pendingContracts = appliedContracts.filter((contract: any) => contract.status === 'pending');
      if (pendingContracts.length) {
        const processes = await tx.insert(signatureProcesses).values(pendingContracts.map((contract: any) => ({ tenantId, followupContractId: contract.id }))).returning();
        const participants = await tx.insert(signatureParticipants).values(processes.flatMap((process: any) => [
          { id: randomUUID(), tenantId, processId: process.id, role: 'patient', identitySnapshot: { role: 'patient', patientId: patient.id, fullName: patient.fullName, phoneLast4Hash: hashToken(patientPhone!.slice(-4)) } },
          { id: randomUUID(), tenantId, processId: process.id, role: 'professional', identitySnapshot: { role: 'professional', assignment: 'clinic_representative' } },
        ])).returning();
        initialTokens = await issueInitialTokens(tx, tenantId, participants);
      }
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
  const responseItems = items.map((item: any) => ({ ...idShape(item), procedureId: item.procedureId, procedureName: item.procedureName, priceCents: item.priceCents, sessionsTotal: item.sessionsTotal, sessionsPerformed: item.sessionsPerformed, comboId: item.comboId ?? null, comboName: item.comboName ?? null, packagePriceCents: item.packagePriceCents ?? null }));
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
      // Evento encerra com itens escolhidos e não baixados: o não feito vale zero e não vira sessão restante.
      if (existing.offerType !== 'event' && (!items.length || items.some((item) => item.sessionsPerformed < item.sessionsTotal))) throw Object.assign(new Error('O acompanhamento só pode ser concluído quando todas as sessões forem realizadas.'), { status: 409 });
      await tx.update(followups).set({ status, completedAt: new Date(), updatedAt: new Date() }).where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId)));
    } else {
      await tx.update(followups).set({ status, cancellationReason: reason!.trim(), cancelledAt: new Date(), updatedAt: new Date() }).where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId)));
    }
    const applied = await tx.select({ process: signatureProcesses, contract: followupContracts }).from(signatureProcesses).innerJoin(followupContracts, and(eq(followupContracts.tenantId, signatureProcesses.tenantId), eq(followupContracts.id, signatureProcesses.followupContractId))).where(and(eq(signatureProcesses.tenantId, tenantId), eq(followupContracts.followupId, followupId)));
    for (const row of applied) {
      await tx.update(signatureTokens).set({ revokedAt: new Date() }).where(and(eq(signatureTokens.tenantId, tenantId), sql`${signatureTokens.participantId} in (select id from signature_participants where tenant_id = ${tenantId} and process_id = ${row.process.id})`));
      await tx.update(signatureProcesses).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, row.process.id), eq(signatureProcesses.status, 'pending')));
      await tx.update(followupContracts).set({ status: 'cancelled' }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, row.contract.id)));
      if (status === 'cancelled') {
        const people = await tx.select({ id: signatureParticipants.id }).from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.processId, row.process.id)));
        for (const person of people) {
          await tx.insert(signatureEvents).values({ tenantId, participantId: person.id, type: 'cancelled', metadata: { processId: row.process.id, followupContractId: row.contract.id, reason: reason!.trim(), actor: { role: 'clinic' } } });
        }
      }
    }
    return getFollowup(tenantId, followupId, tx);
  });
}

export const cancelFollowup = (tenantId: string, followupId: string, reason: string) => updateFollowupState(tenantId, followupId, 'cancelled', reason);
