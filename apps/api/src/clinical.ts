import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  anamneses, anamnesisVersions, appliedAnamneses, appliedAnamnesisNotes, appliedDocuments,
  documentCleanupJobs, followupContracts, followups, getDatabase, patients, tenants, appliedDocumentRevisions,
  buildProtectedAad, decryptValue, encryptValue,
} from '@clinicare/db';
import { copyVerifiedPdfObject, deleteObject, downloadUrl, verifyPdfObject } from './storage';

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

const documentShape = (row: any, revision: any = null) => ({
  id: row.id, _id: row.id, followupContractId: row.followupContractId, originalHash: row.originalHash,
  originalSize: row.originalSize, currentRevisionId: row.currentRevisionId, legacyUnsupported: row.legacyUnsupported ?? false, createdAt: row.createdAt,
  head: revision ? { id: revision.id, version: revision.version, parentRevisionId: revision.parentRevisionId, contentHash: revision.contentHash, contentSize: revision.contentSize, createdAt: revision.createdAt } : null,
});
async function ownedContract(tenantId: string, followupContractId: string) {
  return (await getDatabase().select({
    id: followupContracts.id,
    contractId: followupContracts.contractId,
    contractVersion: followupContracts.contractVersion,
    renderedPdfObjectKey: followupContracts.renderedPdfObjectKey,
    renderedPdfHash: followupContracts.renderedPdfHash,
    renderedPdfSize: followupContracts.renderedPdfSize,
    renderedPdfContentType: followupContracts.renderedPdfContentType,
  }).from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, followupContractId))))[0];
}
const validSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
const validPdf = (contentType: string, contentHash: unknown, size: unknown) => contentType === 'application/pdf' && validSha256(contentHash) && Number.isSafeInteger(size) && (size as number) > 0;
const validIntentId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/** Applied documents always materialize the immutable PDF copied onto the follow-up contract. */
export async function presignAppliedDocument(tenantId: string, followupContractId: string, contentType?: unknown, contentHash?: unknown, size?: unknown) {
  const contract = await ownedContract(tenantId, followupContractId);
  if (!contract) throw invalid('Contrato aplicado não encontrado.', 404);
  if (!validPdf(contract.renderedPdfContentType ?? '', contract.renderedPdfHash, contract.renderedPdfSize) || !contract.renderedPdfObjectKey) {
    throw invalid('O contrato aplicado não possui PDF renderizado verificado.');
  }
  // Keep this compatibility endpoint read-only. If a caller supplies metadata,
  // it must exactly match the immutable contract snapshot; it never selects an
  // upload object or creates an overwrite-capable presigned PUT.
  if (contentType !== undefined || contentHash !== undefined || size !== undefined) {
    if (contentType !== contract.renderedPdfContentType || typeof contentHash !== 'string' || contentHash.toLowerCase() !== contract.renderedPdfHash!.toLowerCase() || size !== contract.renderedPdfSize) {
      throw invalid('Os metadados do PDF não correspondem ao contrato aplicado.');
    }
  }
  return { objectKey: undefined, contentHash: contract.renderedPdfHash!.toLowerCase(), contentSize: contract.renderedPdfSize!, contentType: contract.renderedPdfContentType! };
}

type CleanupStatus = 'reserved' | 'pending' | 'processing' | 'completed' | 'failed';
const CLEANUP_LEASE_MS = 5 * 60 * 1000;
const cleanupLease = () => new Date(Date.now() + CLEANUP_LEASE_MS);
type CleanupResult = { status: CleanupStatus; error?: string };

async function claimCleanupJob(tenantId: string, jobId: string) {
  const claimToken = randomUUID();
  const now = new Date();
  const rows = await getDatabase().update(documentCleanupJobs).set({
    status: 'processing', claimToken, claimExpiresAt: cleanupLease(),
    attempts: sql`${documentCleanupJobs.attempts} + 1`, attemptedAt: now, updatedAt: now,
  }).where(and(
    eq(documentCleanupJobs.tenantId, tenantId), eq(documentCleanupJobs.id, jobId),
    sql`(${documentCleanupJobs.status} in ('pending', 'failed') or (${documentCleanupJobs.status} = 'processing' and ${documentCleanupJobs.claimExpiresAt} < now()))`,
  )).returning();
  return rows[0] ? { ...(rows[0] as any), claimToken } : null;
}

async function heartbeatCleanupJob(tenantId: string, jobId: string, claimToken: string) {
  const rows = await getDatabase().update(documentCleanupJobs).set({ claimExpiresAt: cleanupLease(), updatedAt: new Date() }).where(and(
    eq(documentCleanupJobs.tenantId, tenantId), eq(documentCleanupJobs.id, jobId), eq(documentCleanupJobs.status, 'processing'), eq(documentCleanupJobs.claimToken, claimToken), sql`${documentCleanupJobs.claimExpiresAt} >= now()`,
  )).returning({ id: documentCleanupJobs.id });
  if (!rows[0]) throw new Error('A limpeza perdeu o lease durante o processamento.');
}

async function heartbeatReservedCleanupJob(tenantId: string, jobId: string) {
  const rows = await getDatabase().update(documentCleanupJobs).set({ reservationExpiresAt: cleanupLease(), updatedAt: new Date() }).where(and(eq(documentCleanupJobs.tenantId, tenantId), eq(documentCleanupJobs.id, jobId), eq(documentCleanupJobs.status, 'reserved'), sql`${documentCleanupJobs.reservationExpiresAt} >= now()`)).returning({ id: documentCleanupJobs.id });
  if (!rows[0]) throw new Error('A reserva de materialização expirou.');
}

async function withReservedCleanupHeartbeat<T>(tenantId: string, jobId: string, operation: () => Promise<T>) {
  const timer = setInterval(() => { void heartbeatReservedCleanupJob(tenantId, jobId).catch(() => undefined); }, Math.max(1_000, Math.floor(CLEANUP_LEASE_MS / 3)));
  try { return await operation(); } finally { clearInterval(timer); }
}

async function releaseReservedCleanupJob(tenantId: string, jobId: string) {
  await getDatabase().update(documentCleanupJobs).set({ status: 'pending', reservationExpiresAt: null, updatedAt: new Date() }).where(and(eq(documentCleanupJobs.tenantId, tenantId), eq(documentCleanupJobs.id, jobId), eq(documentCleanupJobs.status, 'reserved')));
}

async function documentOwnsCleanupKeys(tenantId: string, documentId: string, objectKeys: string[]) {
  const document = (await getDatabase().select({ originalObjectKey: appliedDocuments.originalObjectKey, currentRevisionId: appliedDocuments.currentRevisionId }).from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId))))[0];
  if (!document) return false;
  const revision = document.currentRevisionId ? (await getDatabase().select({ objectKey: appliedDocumentRevisions.objectKey }).from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.id, document.currentRevisionId))))[0] : undefined;
  const ownedKeys = new Set([document.originalObjectKey, revision?.objectKey].filter((key): key is string => Boolean(key)));
  return objectKeys.every((objectKey) => ownedKeys.has(objectKey));
}

/** Runs one durable cleanup job. Invoke this from an operational worker/cron. */
export async function retryDocumentCleanupJob(tenantId: string, jobId: string): Promise<CleanupResult> {
  const job = await claimCleanupJob(tenantId, jobId);
  if (!job) return { status: 'processing' };
  const objectKeys = Array.isArray(job.objectKeys) ? (job.objectKeys as unknown[]).filter((key): key is string => typeof key === 'string' && key.length > 0) : [];
  try {
    await heartbeatCleanupJob(tenantId, jobId, job.claimToken);
    const owned = job.documentId ? await documentOwnsCleanupKeys(tenantId, job.documentId, objectKeys) : false;
    if (!owned) for (const objectKey of objectKeys) { await deleteObject(objectKey); await heartbeatCleanupJob(tenantId, jobId, job.claimToken); }
    await getDatabase().update(documentCleanupJobs).set({ status: 'completed', completedAt: new Date(), lastError: null, claimToken: null, claimExpiresAt: null, updatedAt: new Date() }).where(and(eq(documentCleanupJobs.tenantId, tenantId), eq(documentCleanupJobs.id, jobId), eq(documentCleanupJobs.status, 'processing'), eq(documentCleanupJobs.claimToken, job.claimToken)));
    return { status: 'completed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await getDatabase().update(documentCleanupJobs).set({ status: 'failed', lastError: message, claimToken: null, claimExpiresAt: null, updatedAt: new Date() }).where(and(eq(documentCleanupJobs.tenantId, tenantId), eq(documentCleanupJobs.id, jobId), eq(documentCleanupJobs.status, 'processing'), eq(documentCleanupJobs.claimToken, job.claimToken)));
    return { status: 'failed', error: message };
  }
}

async function reconcileReservedCleanupJobs(tenantId: string) {
  const jobs = await getDatabase().select().from(documentCleanupJobs).where(and(eq(documentCleanupJobs.tenantId, tenantId), eq(documentCleanupJobs.status, 'reserved'), sql`${documentCleanupJobs.reservationExpiresAt} is not null and ${documentCleanupJobs.reservationExpiresAt} < now()`));
  return Promise.all(jobs.map(async (job) => { await releaseReservedCleanupJob(tenantId, job.id); return retryDocumentCleanupJob(tenantId, job.id); }));
}

export async function retryDocumentCleanupJobs(tenantId: string) {
  const jobs = await getDatabase().select({ id: documentCleanupJobs.id }).from(documentCleanupJobs).where(and(eq(documentCleanupJobs.tenantId, tenantId), sql`${documentCleanupJobs.status} in ('pending', 'failed') or (${documentCleanupJobs.status} = 'processing' and ${documentCleanupJobs.claimExpiresAt} < now())`));
  const results = await Promise.all(jobs.map((job) => retryDocumentCleanupJob(tenantId, job.id)));
  return results.concat(await reconcileReservedCleanupJobs(tenantId));
}

export async function materializeAppliedDocument(tenantId: string, followupContractId: string, _input: unknown = {}) {
  const result = await materializeAppliedDocumentResult(tenantId, followupContractId, _input);
  return result.document;
}

export async function materializeAppliedDocumentResult(tenantId: string, followupContractId: string, _input: unknown = {}) {
  const contract = await ownedContract(tenantId, followupContractId);
  if (!contract) throw invalid('Contrato aplicado não encontrado.', 404);
  if (!contract.renderedPdfObjectKey || !validPdf(contract.renderedPdfContentType ?? '', contract.renderedPdfHash, contract.renderedPdfSize)) {
    throw invalid('O contrato aplicado não possui PDF renderizado verificado.');
  }
  const db = getDatabase();
  // Lock only long enough to validate the immutable source and reserve the
  // destination cleanup job. Storage I/O happens after this transaction commits.
  const preparation = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from followup_contracts where tenant_id = ${tenantId} and id = ${followupContractId} for update`);
    const lockedContract = (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, followupContractId))))[0];
    if (!lockedContract?.renderedPdfObjectKey || !validPdf(lockedContract.renderedPdfContentType ?? '', lockedContract.renderedPdfHash, lockedContract.renderedPdfSize)) throw invalid('O contrato aplicado não possui PDF renderizado verificado.');
    const existing = (await tx.select().from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.followupContractId, followupContractId))))[0];
    if (existing) {
      if (existing.legacyUnsupported) throw invalid('O documento legado não pode ser materializado; migre-o com uma operação verificada.');
      return { existingId: existing.id };
    }
    const destinationKey = randomUUID();
    const jobResult = await tx.insert(documentCleanupJobs).values({ tenantId, objectKeys: [destinationKey], status: 'reserved', reservationExpiresAt: cleanupLease() }).returning() as any;
    const job = jobResult[0];
    return { lockedContract, destinationKey, jobId: job.id };
  });
  if ('existingId' in preparation) return { document: await getAppliedDocument(tenantId, preparation.existingId), existing: true as const };

  const { lockedContract, destinationKey, jobId } = preparation;
  try {
    await heartbeatReservedCleanupJob(tenantId, jobId);
    await withReservedCleanupHeartbeat(tenantId, jobId, async () => {
      const verified = await verifyPdfObject(lockedContract.renderedPdfObjectKey!, lockedContract.renderedPdfHash!, lockedContract.renderedPdfSize!);
      if (!verified) throw invalid('O PDF renderizado verificado não está disponível ou não corresponde aos metadados.');
      await heartbeatReservedCleanupJob(tenantId, jobId);
      await copyVerifiedPdfObject(lockedContract.renderedPdfObjectKey!, destinationKey, lockedContract.renderedPdfHash!, lockedContract.renderedPdfSize!);
      await heartbeatReservedCleanupJob(tenantId, jobId);
    });
  } catch (error) {
    await releaseReservedCleanupJob(tenantId, jobId);
    const cleanup = await retryDocumentCleanupJob(tenantId, jobId);
    if (cleanup.status === 'failed') throw invalid(`Não foi possível materializar o documento e a limpeza ficou pendente: ${cleanup.error}` , 503);
    throw error;
  }

  let document;
  try {
    document = await db.transaction(async (tx) => {
      const id = randomUUID(), revisionId = randomUUID();
      await tx.execute(sql`select set_config('app.constructing_applied_document', 'on', true)`);
      const rowResult = await tx.insert(appliedDocuments).values({ id, tenantId, followupContractId, originalObjectKey: destinationKey, originalHash: lockedContract.renderedPdfHash, originalSize: lockedContract.renderedPdfSize }).returning() as any;
      const row = rowResult[0];
      const revisionResult = await tx.insert(appliedDocumentRevisions).values({ id: revisionId, tenantId, documentId: id, version: 1, parentRevisionId: null, objectKey: destinationKey, contentHash: lockedContract.renderedPdfHash, contentSize: lockedContract.renderedPdfSize }).returning() as any;
      const revision = revisionResult[0];
      const updatedResult = await tx.update(appliedDocuments).set({ currentRevisionId: revision.id }).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, id), isNull(appliedDocuments.currentRevisionId))).returning();
      const updated = updatedResult[0];
      // Keep the outbox row through this transaction. If the process dies after
      // this commit, the retry can see that the copied key is now owned and
      // reconcile the job without deleting the document's object.
      await tx.update(documentCleanupJobs).set({ documentId: id, status: 'pending', reservationExpiresAt: null, updatedAt: new Date() }).where(and(eq(documentCleanupJobs.tenantId, tenantId), eq(documentCleanupJobs.id, jobId), eq(documentCleanupJobs.status, 'reserved')));
      await tx.execute(sql`select set_config('app.constructing_applied_document', 'off', true)`);
      return documentShape(updated ?? row, revision);
    });
  } catch (error) {
    await releaseReservedCleanupJob(tenantId, jobId);
    const cleanup = await retryDocumentCleanupJob(tenantId, jobId);
    if (cleanup.status === 'failed') throw invalid(`A materialização falhou e a limpeza ficou pendente: ${cleanup.error}`, 503);
    throw error;
  }

  // The materialization transaction has committed, so reconciliation can now
  // safely complete the job without treating the copied object as orphaned.
  const cleanup = await retryDocumentCleanupJob(tenantId, jobId);
  if (cleanup.status === 'failed') throw invalid(`O documento foi materializado, mas a limpeza ficou pendente: ${cleanup.error}`, 503);
  return { document, existing: false as const };
}
export async function listAppliedDocuments(tenantId: string, followupContractId: string) {
  if (!await ownedContract(tenantId, followupContractId)) return null;
  const rows = await getDatabase().select().from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.followupContractId, followupContractId))).orderBy(desc(appliedDocuments.createdAt));
  return Promise.all(rows.map(async (row) => { const revision = row.currentRevisionId ? (await getDatabase().select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.id, row.currentRevisionId))))[0] : null; return documentShape(row, revision); }));
}
export async function getAppliedDocument(tenantId: string, documentId: string) {
  const row = (await getDatabase().select().from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId))))[0];
  if (!row) return null;
  if (!row.currentRevisionId) return row.legacyUnsupported ? documentShape(row) : null;
  const revision = (await getDatabase().select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.id, row.currentRevisionId))))[0];
  return revision ? { ...documentShape(row, revision), originalUrl: await downloadUrl(row.originalObjectKey), url: await downloadUrl(revision.objectKey) } : null;
}
export async function deleteAppliedDocument(tenantId: string, documentId: string) {
  const db = getDatabase();
  const prepared = await db.transaction(async (tx) => {
    // Lock and snapshot the aggregate before touching storage. The cleanup job
    // is written in this same transaction, so a post-commit process crash is
    // recoverable without retaining the aggregate rows.
    await tx.execute(sql`select id from applied_documents where tenant_id = ${tenantId} and id = ${documentId} for update`);
    const row = (await tx.select().from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId))))[0];
    if (!row) return null;
    // Only document-owned materialized keys are eligible. In particular, never
    // include followup_contracts.rendered_pdf_object_key (the catalog source).
    const revisions = await tx.select({ objectKey: appliedDocumentRevisions.objectKey }).from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, documentId)));
    const objectKeys = [...new Set([row.originalObjectKey, ...revisions.map((revision) => revision.objectKey)].filter((key): key is string => Boolean(key)))];
    const jobResult = await tx.insert(documentCleanupJobs).values({ tenantId, documentId, objectKeys, status: 'pending' }).returning() as any;
    const job = jobResult[0];
    await tx.execute(sql`select set_config('app.purging_applied_document', 'on', true)`);
    // The composite FK intentionally prevents clearing HEAD during ordinary
    // operation; this controlled aggregate purge is the one exception.
    await tx.update(appliedDocuments).set({ currentRevisionId: null }).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId)));
    await tx.delete(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, documentId)));
    await tx.delete(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId)));
    return { objectKeys, jobId: job.id };
  });
  if (!prepared) return null;

  const cleanup = await retryDocumentCleanupJob(tenantId, prepared.jobId);
  // The aggregate is already durably deleted. Return the durable failure to the
  // caller rather than pretending that object cleanup succeeded.
  return { deleted: true, objectKeys: prepared.objectKeys, cleanup };
}
