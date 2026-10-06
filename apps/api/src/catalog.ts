import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  anamneses, anamnesisProcedures, anamnesisVersions, combos, comboItems, contracts, contractVersions, contractVersionPdfUploadIntents,
  getDatabase, planVersionContracts, planVersionItems, planVersions, plans, procedureVersions, procedures,
} from '@clinicare/db';
import { uploadUrlForPdf, verifyPdfObject } from './storage';

const tenantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function catalogTenant(request: { header(name: string): string | undefined }, authenticatedTenantId?: string) {
  const tenantId = authenticatedTenantId ?? request.header('x-tenant-id') ?? '';
  if (!tenantUuid.test(tenantId)) throw new Error('Tenant inválido.');
  const result = await getDatabase().execute(sql`select 1 from tenants where id = ${tenantId}`);
  if (!result.rows.length) throw new Error('Tenant não encontrado.');
  return tenantId;
}


const id = (row: { id: string }) => ({ ...row, _id: row.id });
const schemaOk = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value) && (value as any).type === 'object' && !!(value as any).properties && typeof (value as any).properties === 'object';
const latest = <T extends { version: number }>(rows: T[]) => rows.sort((a, b) => b.version - a.version)[0];
const proceduresFor = async (executor: any, tenantId: string, ids: string[]) => ids.length ? executor.select().from(procedures).where(and(eq(procedures.tenantId, tenantId), inArray(procedures.id, ids))) : [];
const conflict = (expected: unknown, current: number) => expected !== undefined && expected !== current ? new Error('Conflito de versão: o registro foi alterado. Recarregue e tente novamente.') : null;
const validSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const validUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validPdfMetadata = (contentType: unknown, hash: unknown, size: unknown) => contentType === 'application/pdf' && validSha256(hash) && Number.isSafeInteger(size) && (size as number) > 0;

async function lockProcedure(tx: any, tenantId: string, procedureId: string) {
  await tx.execute(sql`select id from procedures where tenant_id = ${tenantId} and id = ${procedureId} for update`);
}
async function lockAnamnesis(tx: any, tenantId: string, id: string) {
  await tx.execute(sql`select id from anamneses where tenant_id = ${tenantId} and id = ${id} for update`);
}
async function lockContract(tx: any, tenantId: string, id: string) {
  await tx.execute(sql`select id from contracts where tenant_id = ${tenantId} and id = ${id} for update`);
}
async function lockPlan(tx: any, tenantId: string, id: string) {
  await tx.execute(sql`select id from plans where tenant_id = ${tenantId} and id = ${id} for update`);
}

export async function listProcedures(tenantId: string) {
  const db = getDatabase(); const rows = await db.select().from(procedures).where(eq(procedures.tenantId, tenantId)).orderBy(desc(procedures.createdAt));
  const versions = await db.select().from(procedureVersions).where(eq(procedureVersions.tenantId, tenantId));
  return rows.map((row) => ({ ...id(row), versions: versions.filter((v) => v.procedureId === row.id).sort((a, b) => a.version - b.version).map((v) => ({ _id: v.id, id: v.id, version: v.version, sessionSchema: v.sessionSchema, createdAt: v.createdAt })), sessionSchema: row.sessionSchema }));
}
export async function createProcedure(tenantId: string, input: any) {
  const schema = input.sessionSchema ?? { type: 'object', properties: {} }; if (!schemaOk(schema)) throw new Error('Dados ou formulário de procedimento inválidos.');
  const db = getDatabase(); const procedureId = crypto.randomUUID();
  return db.transaction(async (tx) => { const [row] = await tx.insert(procedures).values({ id: procedureId, tenantId, name: input.name.trim(), description: input.description ?? null, baseSessions: input.baseSessions ?? null, durationMinutes: input.durationMinutes, standalone: input.baseSessions == null || input.baseSessions < 2, priceCents: input.priceCents ?? 0, sessionSchema: schema, active: input.active !== false, requireNewAnamnesis: input.requireNewAnamnesis === true }).returning(); await tx.insert(procedureVersions).values({ tenantId, procedureId, version: 1, sessionSchema: schema }); return { ...id(row), versions: [{ version: 1, sessionSchema: schema, createdAt: row.createdAt }], sessionSchema: schema }; });
}
export async function updateProcedure(tenantId: string, procedureId: string, input: any) {
  const db = getDatabase(); return db.transaction(async (tx) => {
    await lockProcedure(tx, tenantId, procedureId);
    const [old] = await tx.select().from(procedures).where(and(eq(procedures.tenantId, tenantId), eq(procedures.id, procedureId))); if (!old) return null;
    const stale = conflict(input.expectedVersion, old.currentVersion); if (stale) throw stale;
    const hasSchema = input.sessionSchema !== undefined; const values: any = { updatedAt: new Date() };
    for (const key of ['name', 'description', 'baseSessions', 'durationMinutes', 'priceCents', 'active', 'requireNewAnamnesis']) if (input[key] !== undefined) values[key] = input[key];
    if (input.baseSessions !== undefined) values.standalone = input.baseSessions == null || input.baseSessions < 2;
    let version = old.currentVersion;
    if (hasSchema) { if (!schemaOk(input.sessionSchema)) throw new Error('Dados ou formulário de procedimento inválidos.'); version++; values.sessionSchema = input.sessionSchema; values.currentVersion = version; await tx.insert(procedureVersions).values({ tenantId, procedureId, version, sessionSchema: input.sessionSchema }); }
    const [row] = await tx.update(procedures).set(values).where(and(eq(procedures.tenantId, tenantId), eq(procedures.id, procedureId))).returning();
    const vs = await tx.select().from(procedureVersions).where(and(eq(procedureVersions.tenantId, tenantId), eq(procedureVersions.procedureId, procedureId))).orderBy(procedureVersions.version); return row ? { ...id(row), versions: vs.map((v) => ({ ...id(v), sessionSchema: v.sessionSchema })), sessionSchema: row.sessionSchema } : null;
  });
}

async function anamnesisResponse(tenantId: string, row: any, executor = getDatabase()) { const [vs, links] = await Promise.all([executor.select().from(anamnesisVersions).where(and(eq(anamnesisVersions.tenantId, tenantId), eq(anamnesisVersions.anamnesisId, row.id))).orderBy(anamnesisVersions.version), executor.select().from(anamnesisProcedures).where(and(eq(anamnesisProcedures.tenantId, tenantId), eq(anamnesisProcedures.anamnesisId, row.id)))]); return { ...id(row), procedureIds: links.map((x: any) => x.procedureId), versions: vs.map((v: any) => ({ ...id(v), schema: v.schema })) }; }
export async function listAnamneses(tenantId: string) { const rows = await getDatabase().select().from(anamneses).where(eq(anamneses.tenantId, tenantId)).orderBy(desc(anamneses.createdAt)); return Promise.all(rows.map((r) => anamnesisResponse(tenantId, r))); }
export async function createAnamnesis(tenantId: string, input: any) { if (!schemaOk(input.schema) || typeof input.title !== 'string' || input.title.trim().length < 2) throw new Error('Informe o nome e ao menos um campo válido.'); const db = getDatabase(); const anamnesisId = crypto.randomUUID(); const row = await db.transaction(async (tx) => { const [created] = await tx.insert(anamneses).values({ id: anamnesisId, tenantId, title: input.title.trim(), validityMonths: input.validityMonths ?? 12, requiredByDefault: input.requiredByDefault !== false }).returning(); await tx.insert(anamnesisVersions).values({ tenantId, anamnesisId, version: 1, schema: input.schema }); if (input.procedureIds?.length) await tx.insert(anamnesisProcedures).values(input.procedureIds.map((procedureId: string) => ({ tenantId, anamnesisId, procedureId, required: true }))); return created; }); return anamnesisResponse(tenantId, row); }
export async function updateAnamnesis(tenantId: string, anamnesisId: string, input: any) { const db = getDatabase(); const [row] = await db.update(anamneses).set({ ...(input.title !== undefined ? { title: input.title.trim() } : {}), ...(input.validityMonths !== undefined ? { validityMonths: input.validityMonths } : {}), ...(input.active !== undefined ? { active: input.active } : {}), updatedAt: new Date() }).where(and(eq(anamneses.tenantId, tenantId), eq(anamneses.id, anamnesisId))).returning(); return row ? anamnesisResponse(tenantId, row) : null; }
export async function addAnamnesisVersion(tenantId: string, anamnesisId: string, input: any) { const db = getDatabase(); return db.transaction(async (tx) => { await lockAnamnesis(tx, tenantId, anamnesisId); const [row] = await tx.select().from(anamneses).where(and(eq(anamneses.tenantId, tenantId), eq(anamneses.id, anamnesisId))); if (!row) return null; const stale = conflict(input.expectedVersion, row.currentVersion); if (stale) throw stale; const source = input.restoreVersion ? (await tx.select().from(anamnesisVersions).where(and(eq(anamnesisVersions.tenantId, tenantId), eq(anamnesisVersions.anamnesisId, anamnesisId), eq(anamnesisVersions.version, input.restoreVersion))))[0] : null; if (input.restoreVersion && !source) throw new Error('Versão não encontrada.'); const schema = source?.schema ?? input.schema; if (!schemaOk(schema)) throw new Error('Formulário inválido.'); const version = row.currentVersion + 1; const [created] = await tx.insert(anamnesisVersions).values({ tenantId, anamnesisId, version, schema, origin: source ? 'restored' : 'edited', restoredFromVersion: source?.version ?? null }).returning(); await tx.update(anamneses).set({ currentVersion: version, updatedAt: new Date() }).where(and(eq(anamneses.tenantId, tenantId), eq(anamneses.id, anamnesisId))); return { ...id(created), schema: created.schema }; }); }
export async function associateAnamnesis(tenantId: string, anamnesisId: string, procedureList: any[]) { const db = getDatabase(); return db.transaction(async (tx) => { const [row] = await tx.select().from(anamneses).where(and(eq(anamneses.tenantId, tenantId), eq(anamneses.id, anamnesisId))); if (!row) return null; await tx.delete(anamnesisProcedures).where(and(eq(anamnesisProcedures.tenantId, tenantId), eq(anamnesisProcedures.anamnesisId, anamnesisId))); if (procedureList.length) await tx.insert(anamnesisProcedures).values(procedureList.map((p) => ({ tenantId, anamnesisId, procedureId: p.procedureId, required: p.required !== false }))); return anamnesisResponse(tenantId, row, tx); }); }

async function comboResponse(tenantId: string, row: any, executor = getDatabase()) { const items = await executor.select().from(comboItems).where(and(eq(comboItems.tenantId, tenantId), eq(comboItems.comboId, row.id))); const ps = await proceduresFor(executor, tenantId, items.map((x: any) => x.procedureId)); return { ...id(row), items: items.map((item: any) => ({ ...id(item), procedureId: id(ps.find((p: any) => p.id === item.procedureId)!), sessions: item.sessions, sessionsOverride: item.sessions })) }; }
export async function listCombos(tenantId: string) { const rows = await getDatabase().select().from(combos).where(eq(combos.tenantId, tenantId)).orderBy(desc(combos.createdAt)); return Promise.all(rows.map((r) => comboResponse(tenantId, r))); }
function comboValid(input: any) {
  if (typeof input.name !== 'string' || !Array.isArray(input.items) || input.items.length === 0 || !input.items.every((x: any) => typeof x.procedureId === 'string' && Number.isInteger(x.sessions) && x.sessions >= 1)) return false;
  const from = input.validFrom == null ? null : new Date(input.validFrom);
  const until = input.validUntil == null ? null : new Date(input.validUntil);
  return (!from || !Number.isNaN(from.getTime())) && (!until || !Number.isNaN(until.getTime())) && (!from || !until || until >= from);
}
export async function saveCombo(tenantId: string, comboId: string | null, input: any) { if (!comboValid(input)) throw new Error('Combo requer nome, preço e procedimentos com número de sessões válido.'); const db = getDatabase(); const row = await db.transaction(async (tx) => { const existing = comboId ? (await tx.select().from(combos).where(and(eq(combos.tenantId, tenantId), eq(combos.id, comboId))))[0] : null; if (comboId && !existing) return null; const rowValues: any = { tenantId, name: input.name?.trim() ?? existing?.name, description: input.description ?? existing?.description ?? null, priceCents: input.priceCents ?? existing?.priceCents, promotionalPriceCents: input.promotionalPriceCents ?? existing?.promotionalPriceCents ?? null, validFrom: input.validFrom ? new Date(input.validFrom) : existing?.validFrom ?? null, validUntil: input.validUntil ? new Date(input.validUntil) : existing?.validUntil ?? null, active: input.active ?? existing?.active ?? true, requireNewAnamnesis: input.requireNewAnamnesis ?? existing?.requireNewAnamnesis ?? false, updatedAt: new Date() }; const [created] = existing ? await tx.update(combos).set(rowValues).where(and(eq(combos.tenantId, tenantId), eq(combos.id, comboId!))).returning() : await tx.insert(combos).values(rowValues).returning(); const target = existing ? comboId! : created.id; await tx.delete(comboItems).where(and(eq(comboItems.tenantId, tenantId), eq(comboItems.comboId, target))); await tx.insert(comboItems).values(input.items.map((x: any) => ({ tenantId, comboId: target, procedureId: x.procedureId, sessions: x.sessions, priceOverrideCents: x.priceOverrideCents ?? null }))); return created; }); return row ? comboResponse(tenantId, row) : null; }

export async function presignContractVersionPdf(tenantId: string, contractId: string, contentType: string, contentHash: string, size: number) {
  if (!validPdfMetadata(contentType, contentHash, size)) throw new Error('O PDF renderizado deve usar o tipo application/pdf e metadados válidos.');
  const db = getDatabase();
  const contract = (await db.select().from(contracts).where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId))))[0];
  if (!contract) throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
  const current = (await db.select().from(contractVersions).where(and(eq(contractVersions.tenantId, tenantId), eq(contractVersions.contractId, contractId), eq(contractVersions.version, contract.currentVersion))))[0];
  if (!current) throw new Error('Versão do contrato não encontrada.');
  if (current.renderedPdfObjectKey) throw new Error('A versão atual já possui um PDF renderizado imutável. Crie uma nova versão antes de enviar outro PDF.');
  const version = contract.currentVersion;
  const intentId = crypto.randomUUID(); const objectKey = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const uploadUrl = await uploadUrlForPdf(objectKey);
  await db.insert(contractVersionPdfUploadIntents).values({ id: intentId, tenantId, contractId, contractVersion: version, objectKey, contentHash: contentHash.toLowerCase(), contentSize: size, contentType, expiresAt });
  return { uploadIntentId: intentId, contractVersion: version, uploadUrl, contentHash: contentHash.toLowerCase(), contentSize: size, expiresInSeconds: 300 };
}
async function consumeContractVersionPdfUploadIntent(tx: any, tenantId: string, contractId: string, version: number, intentId: string) {
  if (!validUuid(intentId)) throw new Error('Intenção de upload inválida.');
  const intent = (await tx.select().from(contractVersionPdfUploadIntents).where(and(eq(contractVersionPdfUploadIntents.tenantId, tenantId), eq(contractVersionPdfUploadIntents.contractId, contractId), eq(contractVersionPdfUploadIntents.contractVersion, version), eq(contractVersionPdfUploadIntents.id, intentId), sql`${contractVersionPdfUploadIntents.consumedAt} is null`)))[0];
  if (!intent || intent.expiresAt <= new Date()) throw new Error('Intenção de upload inválida, expirada ou já utilizada.');
  if (!await verifyPdfObject(intent.objectKey, intent.contentHash, intent.contentSize)) throw new Error('O PDF enviado não corresponde aos metadados declarados.');
  await tx.update(contractVersionPdfUploadIntents).set({ consumedAt: new Date() }).where(and(eq(contractVersionPdfUploadIntents.tenantId, tenantId), eq(contractVersionPdfUploadIntents.id, intent.id), sql`${contractVersionPdfUploadIntents.consumedAt} is null`));
  return intent;
}
export async function finalizeContractVersionPdf(tenantId: string, contractId: string, input: { uploadIntentId: string }) {
  if (!validUuid(input?.uploadIntentId)) throw new Error('Intenção de upload inválida.');
  const db = getDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from contracts where tenant_id = ${tenantId} and id = ${contractId} for update`);
    const contract = (await tx.select().from(contracts).where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId))))[0];
    if (!contract) return null;
    const version = (await tx.select().from(contractVersions).where(and(eq(contractVersions.tenantId, tenantId), eq(contractVersions.contractId, contractId), eq(contractVersions.version, contract.currentVersion))))[0];
    if (!version) throw new Error('Versão do contrato não encontrada.');
    if (version.renderedPdfObjectKey) return contractResponse(tenantId, contract, tx);
    const intent = await consumeContractVersionPdfUploadIntent(tx, tenantId, contractId, contract.currentVersion, input.uploadIntentId);
    await tx.update(contractVersions).set({ renderedPdfObjectKey: intent.objectKey, renderedPdfHash: intent.contentHash, renderedPdfSize: intent.contentSize, renderedPdfContentType: intent.contentType }).where(and(eq(contractVersions.tenantId, tenantId), eq(contractVersions.id, version.id), sql`${contractVersions.renderedPdfObjectKey} is null`));
    return contractResponse(tenantId, contract, tx);
  });
}

async function contractResponse(tenantId: string, row: any, executor = getDatabase()) { const vs = await executor.select().from(contractVersions).where(and(eq(contractVersions.tenantId, tenantId), eq(contractVersions.contractId, row.id))).orderBy(contractVersions.version); return { ...id(row), versions: vs.map((v: any) => ({ ...id(v), content: v.content ?? null, sourceDocxHash: v.sourceDocxHash ?? null, sourceDocxSize: v.sourceDocxSize ?? null, sourceDocxContentType: v.sourceDocxContentType ?? null, hasSourceDocx: Boolean(v.sourceDocxObjectKey), contextConfiguration: v.contextConfiguration ?? null, allowedPlaceholders: v.allowedPlaceholders ?? [], requiredPlaceholders: v.requiredPlaceholders ?? [], renderedPdfHash: v.renderedPdfHash ?? null, renderedPdfSize: v.renderedPdfSize ?? null, renderedPdfContentType: v.renderedPdfContentType ?? null, hasRenderedPdf: Boolean(v.renderedPdfObjectKey) })) }; }
export async function listContracts(tenantId: string) { const rows = await getDatabase().select().from(contracts).where(eq(contracts.tenantId, tenantId)).orderBy(desc(contracts.createdAt)); return Promise.all(rows.map((r) => contractResponse(tenantId, r))); }
const legacyContractGone = () => Object.assign(new Error('O caminho legado de texto foi removido; use draft DOCX + publish.'), { status: 410 });
const validContractKind = (value: unknown): value is 'standard' | 'procedure' | 'combo' => value === 'standard' || value === 'procedure' || value === 'combo';
export async function saveContract(tenantId: string, contractId: string | null, input: any) {
  if (input?.content !== undefined || input?.sourceObjectKey !== undefined || input?.restoreVersion !== undefined) throw legacyContractGone();
  const db = getDatabase(); const row = await db.transaction(async (tx) => { const existing = contractId ? (await tx.select().from(contracts).where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId))))[0] : null; if (contractId && !existing) return null; if (existing) await lockContract(tx, tenantId, existing.id); const kind = input.kind ?? existing?.kind;
    if (kind !== undefined && !validContractKind(kind)) throw new Error('Tipo de contrato inválido.');
    const title = input.title !== undefined ? String(input.title).trim() : existing?.title;
    if (!title || title.length < 2) throw new Error('Informe o nome do contrato.');
    if (kind === 'procedure' && !(input.procedureId ?? existing?.procedureId)) throw new Error('Escolha o procedimento deste contrato.');
    if (kind === 'combo' && !(input.comboId ?? existing?.comboId)) throw new Error('Escolha o combo deste contrato.');
    const values: any = { tenantId, title, kind: kind ?? existing?.kind ?? 'standard', procedureId: (kind ?? existing?.kind) === 'procedure' ? input.procedureId ?? existing?.procedureId : null, comboId: (kind ?? existing?.kind) === 'combo' ? input.comboId ?? existing?.comboId : null, active: input.active ?? existing?.active ?? true, updatedAt: new Date() }; const [row] = existing ? await tx.update(contracts).set(values).where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId!))).returning() : await tx.insert(contracts).values({ ...values, currentVersion: 0 }).returning(); return row; }); return row ? contractResponse(tenantId, row) : null; }
export async function addContractVersion(_tenantId: string, _contractId: string, _input: any): Promise<never> { throw legacyContractGone(); }

async function planResponse(tenantId: string, row: any, executor = getDatabase()) { const v = (await executor.select().from(planVersions).where(and(eq(planVersions.tenantId, tenantId), eq(planVersions.planId, row.id), eq(planVersions.version, row.currentVersion))))[0]; if (!v) return { ...id(row), priceCents: 0, items: [], contractIds: [] }; const [items, cs] = await Promise.all([executor.select().from(planVersionItems).where(and(eq(planVersionItems.tenantId, tenantId), eq(planVersionItems.planVersionId, v.id))), executor.select().from(planVersionContracts).where(and(eq(planVersionContracts.tenantId, tenantId), eq(planVersionContracts.planVersionId, v.id)))]); return { ...id(row), priceCents: v.priceCents, durationDays: v.durationDays, validityDays: v.validityDays, requireNewAnamnesis: v.requireNewAnamnesis, items: items.map((x: any) => ({ offerType: 'procedure', offerId: x.procedureId, sessions: x.sessions, procedureName: x.procedureName, durationMinutes: x.durationMinutes, priceCents: x.priceCents, sessionSchema: x.sessionSchema })), contractIds: cs.map((x: any) => x.contractId), versions: [{ id: v.id, version: v.version, priceCents: v.priceCents, createdAt: v.createdAt }] }; }
export async function listPlans(tenantId: string) { const rows = await getDatabase().select().from(plans).where(eq(plans.tenantId, tenantId)).orderBy(desc(plans.createdAt)); return Promise.all(rows.map((r) => planResponse(tenantId, r))); }
export async function savePlan(tenantId: string, planId: string | null, input: any) {
  const db = getDatabase();
  const row = await db.transaction(async (tx) => {
    const existing = planId ? (await tx.select().from(plans).where(and(eq(plans.tenantId, tenantId), eq(plans.id, planId))))[0] : null;
    if (planId && !existing) return null;
    if (existing) { await lockPlan(tx, tenantId, existing.id); if (input.expectedVersion !== undefined) { const stale = conflict(input.expectedVersion, existing.currentVersion); if (stale) throw stale; } }
    const offerChange = ['items', 'priceCents', 'durationDays', 'validityDays', 'contractIds', 'requireNewAnamnesis'].some((key) => input[key] !== undefined);
    const values: any = { tenantId, name: input.name?.trim() ?? existing?.name, description: input.description ?? existing?.description ?? null, active: input.active ?? existing?.active ?? true, updatedAt: new Date() };
    if (existing && !offerChange) { const [updated] = await tx.update(plans).set(values).where(and(eq(plans.tenantId, tenantId), eq(plans.id, planId!))).returning(); return updated; }
    if (!Array.isArray(input.items) || !input.items.length || input.items.some((x: any) => x.offerType !== 'procedure' || typeof x.offerId !== 'string' || !Number.isInteger(x.sessions) || x.sessions < 1)) throw new Error('Plano aceita somente procedimentos com sessões válidas.');
    if (!Array.isArray(input.contractIds) || !input.contractIds.length) throw new Error('Plano requer ao menos um contrato aplicável.');
    const ps = await tx.select().from(procedures).where(and(eq(procedures.tenantId, tenantId), inArray(procedures.id, input.items.map((x: any) => x.offerId)))); if (ps.length !== input.items.length) throw new Error('Procedimento não encontrado.');
    const cs = await tx.select().from(contracts).where(and(eq(contracts.tenantId, tenantId), inArray(contracts.id, input.contractIds), eq(contracts.active, true))); if (!cs.length || cs.length !== input.contractIds.length) throw new Error('Contrato não encontrado ou inativo.'); if (!cs.some((c) => c.kind === 'standard' || (c.kind === 'procedure' && input.items.some((x: any) => x.offerId === c.procedureId)))) throw new Error('Plano requer ao menos um contrato aplicável.');
    const [row] = existing ? await tx.update(plans).set(values).where(and(eq(plans.tenantId, tenantId), eq(plans.id, planId!))).returning() : await tx.insert(plans).values(values).returning();
    const version = existing ? existing.currentVersion + 1 : 1; const [v] = await tx.insert(planVersions).values({ tenantId, planId: row.id, version, priceCents: input.priceCents, durationDays: input.durationDays ?? null, validityDays: input.validityDays ?? null, requireNewAnamnesis: input.requireNewAnamnesis === true }).returning();
    await tx.insert(planVersionItems).values(input.items.map((x: any) => { const p = ps.find((a) => a.id === x.offerId)!; if (x.sessions < (p.baseSessions ?? 1)) throw new Error('A quantidade de sessões do plano não pode ser menor que a base do procedimento.'); return { tenantId, planVersionId: v.id, procedureId: p.id, sessions: x.sessions, procedureName: p.name, durationMinutes: p.durationMinutes, priceCents: p.priceCents, sessionSchema: p.sessionSchema }; }));
    const cvs = await tx.select().from(contractVersions).where(and(eq(contractVersions.tenantId, tenantId), inArray(contractVersions.contractId, input.contractIds))); await tx.insert(planVersionContracts).values(input.contractIds.map((contractId: string) => { const c = cs.find((x) => x.id === contractId)!; const cv = latest(cvs.filter((x) => x.contractId === contractId)); return { tenantId, planVersionId: v.id, contractId, contractVersion: cv?.version ?? null, title: c.title, sourceObjectKey: cv?.sourceObjectKey ?? cv?.sourceDocxObjectKey ?? null }; }));
    await tx.update(plans).set({ currentVersion: version, updatedAt: new Date() }).where(and(eq(plans.tenantId, tenantId), eq(plans.id, row.id))); return { ...row, currentVersion: version };
  });
  return row ? planResponse(tenantId, row) : null;
}
