import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  anamneses, anamnesisVersions, appliedAnamneses, appliedAnamnesisNotes, appliedDocuments,
  followupContracts, followups, getDatabase, patients, tenants,
  buildProtectedAad, decryptValue, encryptValue,
} from '@clinicare/db';
import { downloadUrl, uploadUrl } from './storage';

const invalid = (message: string, status = 400) => Object.assign(new Error(message), { status });
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const expiry = (days: number) => new Date(Date.now() + days * 86400000);
const jsonValue = (value: unknown) => JSON.stringify(value ?? {});
const protect = (tenantId: string, table: string, id: string, column: string, value: unknown) => {
  const encrypted = encryptValue(jsonValue(value), buildProtectedAad(tenantId, table, id, column));
  return { [`${column}Ciphertext`]: encrypted.ciphertext, [`${column}Nonce`]: encrypted.nonce, [`${column}KeyVersion`]: encrypted.keyVersion };
};
const unprotect = (tenantId: string, table: string, id: string, column: string, row: any) => {
  if (!row[`${column}Ciphertext`]) return {};
  const value = decryptValue({ ciphertext: row[`${column}Ciphertext`], nonce: row[`${column}Nonce`], keyVersion: row[`${column}KeyVersion`] }, buildProtectedAad(tenantId, table, id, column));
  return JSON.parse(value);
};
const noteValue = (tenantId: string, id: string, row: any) => decryptValue({ ciphertext: row.contentCiphertext, nonce: row.contentNonce, keyVersion: row.contentKeyVersion }, buildProtectedAad(tenantId, 'applied_anamnesis_notes', id, 'content'));
const appliedShape = (row: any) => ({
  id: row.id, _id: row.id, tenantId: row.tenantId, patientId: row.patientId, followupId: row.followupId,
  anamnesisId: row.anamnesisId, version: row.version, title: row.titleSnapshot, titleSnapshot: row.titleSnapshot,
  schemaSnapshot: row.schemaSnapshot, required: row.required, submittedAt: row.submittedAt, validUntil: row.validUntil,
  createdAt: row.createdAt, draft: unprotect(row.tenantId, 'applied_anamneses', row.id, 'draft', row),
  answers: row.answersCiphertext ? unprotect(row.tenantId, 'applied_anamneses', row.id, 'answers', row) : null,
});

export async function createAppliedAnamnesis(tenantId: string, input: any) {
  if (!input?.patientId || !input?.anamnesisId || !input?.followupId) throw invalid('Paciente, acompanhamento e anamnese são obrigatórios.');
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const patient = (await tx.select({ id: patients.id }).from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.id, input.patientId), isNull(patients.deletedAt))))[0];
    const followup = (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, input.followupId), eq(followups.patientId, input.patientId))))[0];
    const form = (await tx.select().from(anamneses).where(and(eq(anamneses.tenantId, tenantId), eq(anamneses.id, input.anamnesisId))))[0];
    const version = form && (await tx.select().from(anamnesisVersions).where(and(eq(anamnesisVersions.tenantId, tenantId), eq(anamnesisVersions.anamnesisId, form.id), eq(anamnesisVersions.version, form.currentVersion))))[0];
    if (!patient || !followup || !form || !version) throw invalid('Paciente, acompanhamento ou anamnese não encontrados.', 404);
    const [row] = await tx.insert(appliedAnamneses).values({ tenantId, patientId: input.patientId, followupId: input.followupId, anamnesisId: form.id, version: version.version, titleSnapshot: form.title, schemaSnapshot: version.schema, validityMonths: form.validityMonths ?? 12, required: input.required !== false }).returning();
    return appliedShape(row);
  });
}

async function byToken(tx: any, token: string, includeClosed = false) {
  const rows = await tx.select({ applied: appliedAnamneses, active: tenants.active }).from(appliedAnamneses).innerJoin(tenants, eq(tenants.id, appliedAnamneses.tenantId)).where(and(eq(appliedAnamneses.requestTokenHash, hashToken(token)), eq(tenants.active, true), includeClosed ? sql`true` : and(sql`${appliedAnamneses.requestExpiresAt} > now()`, isNull(appliedAnamneses.submittedAt))));
  return rows[0]?.applied;
}
const publicShape = (row: any) => ({ title: row.titleSnapshot, schema: row.schemaSnapshot, draft: unprotect(row.tenantId, 'applied_anamneses', row.id, 'draft', row) });
const clearDraft = { draftCiphertext: null, draftNonce: null, draftKeyVersion: null };

export async function createAnamnesisRequest(tenantId: string, appliedId: string) {
  const token = randomBytes(32).toString('base64url');
  const [row] = await getDatabase().update(appliedAnamneses).set({ requestTokenHash: hashToken(token), requestExpiresAt: expiry(7), ...clearDraft }).where(and(eq(appliedAnamneses.tenantId, tenantId), eq(appliedAnamneses.id, appliedId), isNull(appliedAnamneses.submittedAt))).returning();
  if (!row) throw invalid('Anamnese aplicada não encontrada.', 404);
  return { id: row.id, url: `/public/anamnesis/${token}`, expiresAt: row.requestExpiresAt };
}
export async function refreshAnamnesisRequest(tenantId: string, appliedId: string) { return createAnamnesisRequest(tenantId, appliedId); }
export async function readPublicAnamnesis(token: string) { const row = await byToken(getDatabase(), token); return row ? publicShape(row) : null; }
export async function readAppliedAnamnesis(tenantId: string, appliedId: string) {
  const row = (await getDatabase().select().from(appliedAnamneses).where(and(eq(appliedAnamneses.tenantId, tenantId), eq(appliedAnamneses.id, appliedId))))[0];
  return row ? appliedShape(row) : null;
}
export async function saveAnamnesisDraft(token: string, draft: unknown) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const row = await byToken(tx, token);
    if (!row || row.submittedAt) return false;
    await tx.update(appliedAnamneses).set(protect(row.tenantId, 'applied_anamneses', row.id, 'draft', draft)).where(and(eq(appliedAnamneses.tenantId, row.tenantId), eq(appliedAnamneses.id, row.id), isNull(appliedAnamneses.submittedAt)));
    return true;
  });
}
const validUntilFor = (row: any) => { const date = new Date(); date.setMonth(date.getMonth() + (Number.isInteger(row.validityMonths) && row.validityMonths > 0 ? row.validityMonths : 12)); return date; };
export async function submitPublicAnamnesis(token: string, answers: unknown) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const candidate = await byToken(tx, token);
    if (!candidate || candidate.submittedAt) return null;
    await tx.execute(sql`select id from applied_anamneses where tenant_id = ${candidate.tenantId} and id = ${candidate.id} for update`);
    const row = (await tx.select().from(appliedAnamneses).where(and(eq(appliedAnamneses.tenantId, candidate.tenantId), eq(appliedAnamneses.id, candidate.id), isNull(appliedAnamneses.submittedAt))))[0];
    if (!row) return null;
    const [updated] = await tx.update(appliedAnamneses).set({ ...protect(row.tenantId, 'applied_anamneses', row.id, 'answers', answers), ...clearDraft, submittedAt: new Date(), validUntil: validUntilFor(row), requestExpiresAt: new Date() }).where(and(eq(appliedAnamneses.tenantId, row.tenantId), eq(appliedAnamneses.id, row.id), isNull(appliedAnamneses.submittedAt))).returning();
    return updated ? { submitted: true, validUntil: updated.validUntil } : null;
  });
}
export async function answerAppliedAnamnesis(tenantId: string, appliedId: string, answers: unknown) { return Boolean(await submitApplied(tenantId, appliedId, answers)); }
async function submitApplied(tenantId: string, appliedId: string, answers: unknown) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from applied_anamneses where tenant_id = ${tenantId} and id = ${appliedId} for update`);
    const row = (await tx.select().from(appliedAnamneses).where(and(eq(appliedAnamneses.tenantId, tenantId), eq(appliedAnamneses.id, appliedId), isNull(appliedAnamneses.submittedAt))))[0];
    if (!row) return null;
    return (await tx.update(appliedAnamneses).set({ ...protect(tenantId, 'applied_anamneses', appliedId, 'answers', answers), ...clearDraft, submittedAt: new Date(), validUntil: validUntilFor(row) }).where(and(eq(appliedAnamneses.tenantId, tenantId), eq(appliedAnamneses.id, appliedId), isNull(appliedAnamneses.submittedAt))).returning())[0];
  });
}
export async function addAnamnesisNote(tenantId: string, responseId: string, content: string) {
  if (!content.trim()) throw invalid('Observação obrigatória.');
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const applied = (await tx.select({ id: appliedAnamneses.id, submittedAt: appliedAnamneses.submittedAt }).from(appliedAnamneses).where(and(eq(appliedAnamneses.tenantId, tenantId), eq(appliedAnamneses.id, responseId), sql`${appliedAnamneses.submittedAt} is not null`)))[0];
    if (!applied) return null;
    const id = randomUUID(); const encrypted = encryptValue(content.trim(), buildProtectedAad(tenantId, 'applied_anamnesis_notes', id, 'content'));
    const [row] = await tx.insert(appliedAnamnesisNotes).values({ id, tenantId, appliedAnamnesisId: applied.id, contentCiphertext: encrypted.ciphertext, contentNonce: encrypted.nonce, contentKeyVersion: encrypted.keyVersion }).returning();
    return { id: row.id, content: noteValue(tenantId, row.id, row), createdAt: row.createdAt };
  });
}
export async function listAnamnesisNotes(tenantId: string, responseId: string) {
  const applied = (await getDatabase().select({ id: appliedAnamneses.id }).from(appliedAnamneses).where(and(eq(appliedAnamneses.tenantId, tenantId), eq(appliedAnamneses.id, responseId), sql`${appliedAnamneses.submittedAt} is not null`)))[0];
  if (!applied) return null;
  const rows = await getDatabase().select().from(appliedAnamnesisNotes).where(and(eq(appliedAnamnesisNotes.tenantId, tenantId), eq(appliedAnamnesisNotes.appliedAnamnesisId, responseId))).orderBy(desc(appliedAnamnesisNotes.createdAt));
  return rows.map((row) => ({ id: row.id, content: noteValue(tenantId, row.id, row), createdAt: row.createdAt }));
}

const documentShape = (row: any) => ({ id: row.id, _id: row.id, followupContractId: row.followupContractId, contentHash: row.contentHash, contentType: row.contentType, createdAt: row.createdAt });
async function ownedContract(tenantId: string, followupContractId: string) {
  return (await getDatabase().select({ id: followupContracts.id }).from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, followupContractId))))[0];
}
export async function presignAppliedDocument(tenantId: string, followupContractId: string, contentType: string, contentHash: string | null) {
  if (!await ownedContract(tenantId, followupContractId)) throw invalid('Contrato aplicado não encontrado.', 404);
  const id = randomUUID(), objectKey = randomUUID();
  const signedUploadUrl = await uploadUrl(objectKey, contentType);
  const [row] = await getDatabase().insert(appliedDocuments).values({ id, tenantId, followupContractId, objectKey, contentHash, contentType }).returning();
  return { ...documentShape(row), uploadUrl: signedUploadUrl, expiresInSeconds: 300 };
}
export async function listAppliedDocuments(tenantId: string, followupContractId: string) {
  if (!await ownedContract(tenantId, followupContractId)) return null;
  return (await getDatabase().select().from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.followupContractId, followupContractId))).orderBy(desc(appliedDocuments.createdAt))).map(documentShape);
}
export async function getAppliedDocument(tenantId: string, documentId: string) {
  const row = (await getDatabase().select().from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId))))[0];
  return row ? { ...documentShape(row), url: await downloadUrl(row.objectKey) } : null;
}
export async function deleteAppliedDocument(tenantId: string, documentId: string) {
  const row = (await getDatabase().select().from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId))))[0];
  if (!row) return null;
  await getDatabase().delete(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId)));
  return { deleted: true, objectKey: row.objectKey };
}
