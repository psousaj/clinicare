import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  appliedDocuments, appliedDocumentRevisions, buildProtectedAad, decryptValue, encryptValue, getDatabase, followupContracts, followups, patients,
  signatureEvents, signatureEvidence, signatureOperations, signatureParticipants, signatureProcesses, signatureRevisions, signatureTokens, signaturePreviewCandidates, tenants,
} from '@clinicare/db';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createIncrementalSignaturePdf, validatePlacement, type PdfPlacement } from './pdf-mutation';
import { normalizeEvidence } from './signature-evidence';
import { deleteObject, downloadObjectBytes, uploadObjectBytes, verifyObjectBytes } from './storage';

const previewExpiry = () => new Date(Date.now() + 15 * 60_000);

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const hashBytes = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/**
 * JSONB round-trips through PostgreSQL normalize object key order (keys are
 * serialized alphabetically), while values freshly built in JavaScript keep
 * their original insertion order. Plain `JSON.stringify` equality therefore
 * spuriously fails when comparing a value just read from the database
 * against an equivalent value built in the request. Canonicalize both sides
 * by recursively sorting object keys before stringifying/hashing so
 * structurally-equal values always compare equal regardless of origin.
 */
const canonicalJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalJson((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
};
const stableStringify = (value: unknown) => JSON.stringify(canonicalJson(value));
const hashJson = (value: unknown) => hashBytes(new TextEncoder().encode(stableStringify(value)));
const expiry = () => new Date(Date.now() + 7 * 86400000);
const invalid = (message: string, status = 400) => Object.assign(new Error(message), { status });
const contentAad = (tenantId: string, contractId: string, keyVersion?: number) => buildProtectedAad(tenantId, 'followup_contracts', contractId, 'content', keyVersion);
const evidenceAad = (tenantId: string, participantId: string, keyVersion?: number) => buildProtectedAad(tenantId, 'signature_revisions', participantId, 'evidence', keyVersion);
const terminalFollowup = (status: string) => status === 'cancelled' || status === 'completed';
const fingerprintValue = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { unavailable: true };
  const serialized = JSON.stringify(value);
  return serialized.length <= 4096 ? value : { unavailable: true, reason: 'oversized' };
};
const phoneCode = (value: unknown) => typeof value === 'string' && /^\d{4}$/.test(value) ? value : null;
const phoneAttemptLimit = 5;
const phoneLockDurationMs = 15 * 60_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const professionalActorId = (snapshot: unknown) => snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && typeof (snapshot as { userId?: unknown }).userId === 'string' ? (snapshot as { userId: string }).userId : null;
type ClinicSignatureActor = { userId: string; tenantId: string; user: { id: string; name: string; email: string } };

/** Issues a one-time plaintext token. The database stores only its SHA-256 hash. */
export async function issueSignatureToken(tenantId: string, participantId: string) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from signature_participants where tenant_id = ${tenantId} and id = ${participantId} for update`);
    const participant = (await tx.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.id, participantId))))[0];
    if (!participant) throw invalid('Participante não encontrado.', 404);
    const process = (await tx.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, participant.processId))))[0];
    const contract = process && (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, process.followupContractId))))[0];
    const followup = contract && (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, contract.followupId))))[0];
    if (!process || !contract || !followup) throw invalid('Contrato aplicado não encontrado.', 404);
    if (terminalFollowup(followup.status) || process.status !== 'pending') throw invalid('Este processo de assinatura já foi encerrado.', 409);
    if (participant.status === 'signed') return { participantId, alreadySigned: true };
    await tx.update(signatureTokens).set({ revokedAt: new Date() }).where(and(eq(signatureTokens.tenantId, tenantId), eq(signatureTokens.participantId, participantId), sql`${signatureTokens.revokedAt} is null`));
    const token = randomBytes(32).toString('base64url');
    const expiresAt = expiry();
    await tx.insert(signatureTokens).values({ tenantId, participantId, tokenHash: hashToken(token), expiresAt });
    return { participantId, token, expiresAt, url: `/public/signatures/${token}` };
  });
}

async function tokenParticipant(executor: any, token: string, includeRevoked = false) {
  const row = (await executor.select({ token: signatureTokens, participant: signatureParticipants }).from(signatureTokens).innerJoin(signatureParticipants, and(eq(signatureParticipants.tenantId, signatureTokens.tenantId), eq(signatureParticipants.id, signatureTokens.participantId))).where(and(eq(signatureTokens.tokenHash, hashToken(token)), ...(includeRevoked ? [] : [sql`${signatureTokens.revokedAt} is null`]), sql`${signatureTokens.expiresAt} > now()`)))[0];
  if (!row) throw invalid('Link inválido, expirado ou revogado.', 404);
  return row;
}

async function lockedTokenContext(tx: any, rawToken: string, allowConsumed = false) {
  const candidate = await tokenParticipant(tx, rawToken, true);
  const [tenant] = await tx.select({ active: tenants.active }).from(tenants).where(eq(tenants.id, candidate.participant.tenantId));
  if (!tenant?.active) throw invalid('Link inválido, expirado ou revogado.', 404);
  const tenantId = candidate.participant.tenantId;
  const processBefore = (await tx.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, candidate.participant.processId))))[0];
  const contractBefore = processBefore && (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, processBefore.followupContractId))))[0];
  if (!processBefore || !contractBefore) throw invalid('Contrato aplicado não encontrado.', 404);
  await tx.execute(sql`select id from followups where tenant_id = ${tenantId} and id = ${contractBefore.followupId} for update`);
  await tx.execute(sql`select id from signature_processes where tenant_id = ${tenantId} and id = ${processBefore.id} for update`);
  await tx.execute(sql`select id from signature_participants where tenant_id = ${tenantId} and id = ${candidate.participant.id} for update`);
  await tx.execute(sql`select id from signature_tokens where tenant_id = ${tenantId} and id = ${candidate.token.id} for update`);
  const active = await tokenParticipant(tx, rawToken).catch(() => null);
  const participant = (await tx.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.id, candidate.participant.id))))[0];
  const token = (await tx.select().from(signatureTokens).where(and(eq(signatureTokens.tenantId, tenantId), eq(signatureTokens.id, candidate.token.id))))[0];
  const process = (await tx.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, candidate.participant.processId))))[0];
  const contract = process && (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, process.followupContractId))))[0];
  const followup = contract && (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, contract.followupId))))[0];
  if (!participant || !process || !contract || !followup) throw invalid('Contrato aplicado não encontrado.', 404);
  if (terminalFollowup(followup.status) || process.status !== 'pending') throw invalid('Este processo de assinatura já foi encerrado.', 409);
  if (!active) {
    if (!(allowConsumed && participant.status === 'signed' && token?.revokedAt)) throw invalid('Link inválido, expirado ou revogado.', 404);
    return { token, participant, process, contract, followup, consumed: true };
  }
  if (participant.status === 'revoked') throw invalid('Este participante não pode assinar.', 409);
  return { token: active.token, participant: active.participant, process, contract, followup, consumed: false };
}

async function lockedParticipantContext(tx: any, participantId: string, actor: ClinicSignatureActor) {
  if (!uuid.test(participantId)) throw invalid('Participante inválido.', 400);
  const candidate = (await tx.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, actor.tenantId), eq(signatureParticipants.id, participantId))))[0];
  if (!candidate) throw invalid('Participante não encontrado.', 404);
  await tx.execute(sql`select id from followup_contracts where tenant_id = ${actor.tenantId} and id = (select followup_contract_id from signature_processes where tenant_id = ${actor.tenantId} and id = ${candidate.processId}) for update`);
  await tx.execute(sql`select id from signature_processes where tenant_id = ${actor.tenantId} and id = ${candidate.processId} for update`);
  await tx.execute(sql`select id from signature_participants where tenant_id = ${actor.tenantId} and id = ${candidate.id} for update`);
  const participant = (await tx.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, actor.tenantId), eq(signatureParticipants.id, candidate.id))))[0];
  const process = (await tx.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, actor.tenantId), eq(signatureProcesses.id, participant.processId))))[0];
  const contract = process && (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, actor.tenantId), eq(followupContracts.id, process.followupContractId))))[0];
  const followup = contract && (await tx.select().from(followups).where(and(eq(followups.tenantId, actor.tenantId), eq(followups.id, contract.followupId))))[0];
  if (!process || !contract || !followup) throw invalid('Contrato aplicado não encontrado.', 404);
  if (terminalFollowup(followup.status) || process.status !== 'pending') throw invalid('Este processo de assinatura já foi encerrado.', 409);
  if (participant.role !== 'professional') throw invalid('A sessão autenticada só pode assinar como representante.', 403);
  const boundUserId = professionalActorId(participant.identitySnapshot);
  if (boundUserId && boundUserId !== actor.userId) throw invalid('Este representante não está vinculado à sessão autenticada.', 403);
  if (participant.status === 'revoked') throw invalid('Este participante não pode assinar.', 409);
  return { token: null, participant, process, contract, followup, consumed: false };
}

async function lockedAccessContext(tx: any, access: string, allowConsumed: boolean, actor?: ClinicSignatureActor) {
  if (access.startsWith('participant:')) {
    if (!actor) throw invalid('Autenticação necessária.', 401);
    return lockedParticipantContext(tx, access.slice('participant:'.length), actor);
  }
  return lockedTokenContext(tx, access, allowConsumed);
}

async function currentDocument(tx: any, tenantId: string, contractId: string) {
  const contract = (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, contractId))))[0];
  if (!contract) throw invalid('Contrato aplicado não encontrado.', 404);
  const document = (await tx.select().from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.followupContractId, contractId))))[0];
  if (!document?.currentRevisionId) throw invalid('O documento PDF ainda não foi materializado.', 409);
  const revision = (await tx.select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.id, document.currentRevisionId))))[0];
  if (!revision) throw invalid('HEAD do documento não encontrado.', 409);
  return { contract, document, revision };
}

export async function verifySignaturePhone(token: string, phoneLast4: unknown) {
  const code = phoneCode(phoneLast4);
  if (!code) throw invalid('Os quatro últimos dígitos do telefone são obrigatórios.');
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const found = await lockedTokenContext(tx, token);
    if (found.participant.role !== 'patient') return { verified: true };
    if (found.token.phoneVerifiedAt) return { verified: true, participantId: found.participant.id };
    if (found.token.phoneLockedUntil && found.token.phoneLockedUntil > new Date()) throw invalid('Muitas tentativas. Tente novamente mais tarde.', 429);
    const snapshot = found.participant.identitySnapshot as { phoneLast4Hash?: unknown } | null;
    if (!snapshot?.phoneLast4Hash || snapshot.phoneLast4Hash !== hashToken(code)) {
      const attempts = (found.token.phoneVerificationAttempts ?? 0) + 1;
      await tx.update(signatureTokens).set({ phoneVerificationAttempts: attempts, phoneLockedUntil: attempts >= phoneAttemptLimit ? new Date(Date.now() + phoneLockDurationMs) : null }).where(and(eq(signatureTokens.tenantId, found.participant.tenantId), eq(signatureTokens.id, found.token.id), isNull(signatureTokens.revokedAt)));
      throw invalid(attempts >= phoneAttemptLimit ? 'Muitas tentativas. Tente novamente mais tarde.' : 'Os quatro últimos dígitos do telefone não conferem.', attempts >= phoneAttemptLimit ? 429 : 403);
    }
    const verifiedAt = new Date();
    await tx.update(signatureTokens).set({ phoneVerifiedAt: verifiedAt, phoneVerificationAttempts: 0, phoneLockedUntil: null }).where(and(eq(signatureTokens.tenantId, found.participant.tenantId), eq(signatureTokens.id, found.token.id), isNull(signatureTokens.revokedAt)));
    return { verified: true, participantId: found.participant.id };
  });
}

export async function readSignatureToken(token: string) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const found = await lockedTokenContext(tx, token);
    if (found.participant.role === 'professional') throw invalid('O representante deve acessar pelo painel autenticado da clínica.', 403);
    if (found.participant.role === 'patient' && !found.token.phoneVerifiedAt) {
      return { participantId: found.participant.id, role: found.participant.role, status: 'verification_required', expiresAt: found.token.expiresAt, phoneVerificationRequired: true };
    }
    const { participant, token: tokenRow, contract } = found;
    const content = contract.contentCiphertext ? decryptValue({ ciphertext: contract.contentCiphertext, nonce: contract.contentNonce!, keyVersion: contract.contentKeyVersion! }, contentAad(participant.tenantId, contract.id, contract.contentKeyVersion!)) : null;
    const document = await currentDocument(tx, participant.tenantId, contract.id);
    return { participantId: participant.id, role: participant.role, status: participant.status, expiresAt: tokenRow.expiresAt, document: { id: document.document.id, revisionId: document.revision.id, version: document.revision.version, hash: document.revision.contentHash, size: document.revision.contentSize, url: `/public/signatures/${token}/pdf` }, contract: { id: contract.id, followupId: contract.followupId, title: contract.titleSnapshot, version: contract.contractVersion, content, sourceObjectKey: contract.sourceObjectKey } };
  });
}

export async function refreshSignatureToken(tenantId: string, participantId: string) {
  if (!uuid.test(participantId)) throw invalid('Participante inválido.');
  return issueSignatureToken(tenantId, participantId);
}

function operationInput(input: unknown) {
  if (!input || typeof input !== 'object') throw invalid('Operação de assinatura inválida.');
  const value = input as Record<string, unknown>;
  if (typeof value.baseRevisionId !== 'string' || !uuid.test(value.baseRevisionId)) throw invalid('Revisão-base inválida.');
  if (typeof value.documentId !== 'string' || !uuid.test(value.documentId)) throw invalid('Documento inválido.');
  if (typeof value.signaturePng !== 'string' || !value.signaturePng.startsWith('data:image/png;base64,')) throw invalid('Imagem de assinatura PNG inválida.');
  if (typeof value.idempotencyKey !== 'string' || value.idempotencyKey.trim().length < 8 || value.idempotencyKey.length > 200) throw invalid('Chave de idempotência inválida.');
  const acceptanceText = typeof value.acceptanceText === 'string' ? value.acceptanceText.trim() : '';
  const previewOnly = value.previewOnly === true;
  if ((!previewOnly && value.confirmed !== true) || (!previewOnly && !acceptanceText)) throw invalid('A confirmação explícita e o texto de aceite são obrigatórios.');
  const previewHash = typeof value.previewHash === 'string' && /^[0-9a-f]{64}$/i.test(value.previewHash) ? value.previewHash.toLowerCase() : null;
  return { ...value, baseRevisionId: value.baseRevisionId, documentId: value.documentId, signaturePng: value.signaturePng, idempotencyKey: value.idempotencyKey, placement: value.placement, fingerprint: fingerprintValue(value.fingerprint), acceptanceText, previewOnly, previewHash };
}

function decodePng(dataUrl: string) {
  const encoded = dataUrl.slice('data:image/png;base64,'.length);
  if (encoded.length > 2_800_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw invalid('Imagem de assinatura PNG inválida.');
  const bytes = Uint8Array.from(Buffer.from(encoded, 'base64'));
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength < 68 || bytes.byteLength > 2_000_000 || !png.every((byte, index) => bytes[index] === byte)) throw invalid('Imagem de assinatura PNG inválida.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) throw invalid('Imagem de assinatura PNG inválida.');
  const width = view.getUint32(16), height = view.getUint32(20), colorType = bytes[25];
  if (!width || !height || width > 2400 || height > 1600 || (colorType !== 6 && colorType !== 4)) throw invalid('Imagem de assinatura PNG inválida.');
  return bytes;
}

export async function previewSignature(token: string, input: unknown, actor?: ClinicSignatureActor) {
  const prepared = operationInput({ ...(input as Record<string, unknown>), previewOnly: true });
  if (token.startsWith('participant:') && !actor) throw invalid('Autenticação necessária.', 401);
  const png = decodePng(prepared.signaturePng);
  const document = await getDatabase().transaction(async (tx) => {
    const found = token.startsWith('participant:')
      ? await lockedParticipantContext(tx, token.slice('participant:'.length), actor!)
      : await lockedTokenContext(tx, token);
    if (found.participant.role === 'patient' && !found.token?.phoneVerifiedAt) throw invalid('Os quatro últimos dígitos do telefone devem ser confirmados antes da prévia.', 403);
    const current = await currentDocument(tx, found.participant.tenantId, found.contract.id);
    if (current.document.id !== prepared.documentId || current.revision.id !== prepared.baseRevisionId) throw invalid('STALE_DOCUMENT_REVISION', 409);
    return { tenantId: found.participant.tenantId, participantId: found.participant.id, key: current.revision.objectKey, hash: current.revision.contentHash, size: current.revision.contentSize };
  });
  const candidate = await createIncrementalSignaturePdf(await readDocumentBytes(document), png, prepared.placement);
  const candidateKey = randomUUID();
  await uploadObjectBytes(candidateKey, candidate.bytes);
  try {
    await verifyObjectBytes(candidateKey, candidate.hash, candidate.size);
    await getDatabase().transaction(async (tx) => {
      const existing = (await tx.select().from(signaturePreviewCandidates).where(and(eq(signaturePreviewCandidates.tenantId, document.tenantId), eq(signaturePreviewCandidates.participantId, document.participantId), eq(signaturePreviewCandidates.idempotencyKey, prepared.idempotencyKey))))[0];
      if (existing) {
        if (existing.contentHash !== candidate.hash || existing.signatureImageHash !== hashBytes(png) || existing.expiresAt <= new Date()) throw invalid('IDEMPOTENCY_KEY_REUSED', 409);
        await deleteObject(candidateKey).catch(() => undefined);
        return;
      }
      await tx.insert(signaturePreviewCandidates).values({ tenantId: document.tenantId, participantId: document.participantId, documentId: prepared.documentId, baseRevisionId: prepared.baseRevisionId, objectKey: candidateKey, contentHash: candidate.hash, contentSize: candidate.size, signatureImageHash: hashBytes(png), placement: candidate.placement, idempotencyKey: prepared.idempotencyKey, fingerprint: prepared.fingerprint, expiresAt: previewExpiry() });
    });
  } catch (error) {
    await deleteObject(candidateKey).catch(() => undefined);
    throw error;
  }
  return candidate.bytes;
}

export async function signWithToken(token: string, input: unknown, actor?: ClinicSignatureActor, reqContext?: { ip?: string }) {
  const prepared = operationInput(input);
  if (prepared.previewOnly) throw invalid('A prévia não pode ser confirmada diretamente.', 400);
  if (!prepared.previewHash) throw invalid('A prévia do PDF deve ser gerada antes da confirmação.', 409);
  if (token.startsWith('participant:') && (!actor || !prepared.previewHash)) throw invalid('A prévia do PDF autenticada deve ser gerada antes da confirmação.', 409);
  const png = decodePng(prepared.signaturePng);
  const normalizedEv = normalizeEvidence(prepared.fingerprint);
  const db = getDatabase();
  const preparedContext = await db.transaction(async (tx) => {
    const context = token.startsWith('participant:')
      ? await lockedParticipantContext(tx, token.slice('participant:'.length), actor!)
      : await lockedTokenContext(tx, token, true);
    const signatureImageHash = hashBytes(png);
    const requestHash = hashJson({ method: 'local_handwritten', documentId: prepared.documentId, baseRevisionId: prepared.baseRevisionId, signatureImageHash, placement: prepared.placement, acceptanceText: prepared.acceptanceText, previewHash: prepared.previewHash, fingerprint: normalizedEv.normalizedRepresentation });
    const existing = (await tx.select().from(signatureOperations).where(and(eq(signatureOperations.tenantId, context.participant.tenantId), eq(signatureOperations.participantId, context.participant.id), eq(signatureOperations.idempotencyKey, prepared.idempotencyKey))))[0];
    if (existing) {
      if (existing.requestHash !== requestHash) throw invalid('IDEMPOTENCY_KEY_REUSED', 409);
      return { operation: existing, context, signatureImageHash, requestHash };
    }
    if (context.participant.role !== 'patient') {
      if (!actor || actor.tenantId !== context.participant.tenantId) throw invalid('A assinatura do representante deve usar a sessão autenticada da clínica.', 403);
    } else if (!context.token?.phoneVerifiedAt) throw invalid('Os quatro últimos dígitos do telefone devem ser confirmados antes da assinatura.', 403);
    const document = await currentDocument(tx, context.participant.tenantId, context.contract.id);
    if (document.document.id !== prepared.documentId || document.revision.id !== prepared.baseRevisionId) {
      const error = invalid('STALE_DOCUMENT_REVISION', 409) as Error & { code?: string; currentRevisionId?: string; currentVersion?: number };
      error.code = 'STALE_DOCUMENT_REVISION'; error.currentRevisionId = document.revision.id; error.currentVersion = document.revision.version;
      throw error;
    }
    if (context.participant.status === 'signed') return { alreadySigned: true as const, participant: context.participant };
    return { context, document, signatureImageHash, requestHash };
  });
  if ('alreadySigned' in preparedContext) return signatureResult(db, preparedContext.participant.tenantId, preparedContext.participant.processId);
  let found: { operation: any; context: any; document?: any; previewId?: string };
  if ('operation' in preparedContext) {
    found = { operation: preparedContext.operation, context: preparedContext.context };
  } else {
    const { context, document, signatureImageHash, requestHash } = preparedContext;
    let candidateKey: string;
    let candidateHash: string;
    let candidateSize: number;
    let previewId: string | undefined;
    if (prepared.previewHash) {
      const preview = (await db.select().from(signaturePreviewCandidates).where(and(eq(signaturePreviewCandidates.tenantId, context.participant.tenantId), eq(signaturePreviewCandidates.participantId, context.participant.id), eq(signaturePreviewCandidates.documentId, document.document.id), eq(signaturePreviewCandidates.baseRevisionId, document.revision.id), eq(signaturePreviewCandidates.idempotencyKey, prepared.idempotencyKey), eq(signaturePreviewCandidates.contentHash, prepared.previewHash))))[0];
      if (!preview || preview.expiresAt <= new Date() || preview.signatureImageHash !== signatureImageHash || stableStringify(preview.placement) !== stableStringify(prepared.placement) || hashJson(preview.fingerprint) !== hashJson(prepared.fingerprint)) throw invalid('A prévia do PDF não corresponde à confirmação.', 409);
      candidateKey = preview.objectKey;
      candidateHash = preview.contentHash;
      candidateSize = preview.contentSize;
      previewId = preview.id;
      await verifyObjectBytes(candidateKey, candidateHash, candidateSize);
    } else {
      const baseBytes = await readDocumentBytes({ key: document.revision.objectKey, hash: document.revision.contentHash, size: document.revision.contentSize });
      const candidate = await createIncrementalSignaturePdf(baseBytes, png, prepared.placement);
      candidateKey = randomUUID();
      candidateHash = candidate.hash;
      candidateSize = candidate.size;
      await uploadObjectBytes(candidateKey, candidate.bytes);
      try { await verifyObjectBytes(candidateKey, candidateHash, candidateSize); } catch (error) { await deleteObject(candidateKey).catch(() => undefined); throw error; }
    }
    const imageKey = randomUUID();
    await uploadObjectBytes(imageKey, png, 'image/png');
    try { await verifyObjectBytes(imageKey, signatureImageHash, png.byteLength); } catch (error) { await deleteObject(imageKey).catch(() => undefined); throw error; }
    let operation;
    try {
      operation = await db.transaction(async (tx) => {
        const rows = await tx.insert(signatureOperations).values({ tenantId: context.participant.tenantId, participantId: context.participant.id, documentId: document.document.id, baseRevisionId: document.revision.id, candidateObjectKey: candidateKey, candidateHash, candidateSize, signatureImageObjectKey: imageKey, placement: prepared.placement, idempotencyKey: prepared.idempotencyKey, requestHash, signatureImageHash, acceptanceText: prepared.acceptanceText, identitySnapshot: context.participant.role === 'professional' && actor ? { role: 'professional', userId: actor.userId, name: actor.user.name, email: actor.user.email, tenantId: actor.tenantId } : context.participant.identitySnapshot, fingerprint: prepared.fingerprint, fingerprintCollectorVersion: normalizedEv.collectorVersion, fingerprintNormalizationVersion: normalizedEv.normalizationVersion, fingerprintDigest: normalizedEv.digest, observedIp: reqContext?.ip ?? null, evidenceReceivedAt: new Date(), status: 'prepared' }).onConflictDoNothing({ target: [signatureOperations.tenantId, signatureOperations.participantId, signatureOperations.idempotencyKey] }).returning() as any[];
        return rows[0] ?? (await tx.select().from(signatureOperations).where(and(eq(signatureOperations.tenantId, context.participant.tenantId), eq(signatureOperations.participantId, context.participant.id), eq(signatureOperations.idempotencyKey, prepared.idempotencyKey))))[0];
      });
    } catch (error) {
      await deleteObject(candidateKey).catch(() => undefined);
      await deleteObject(imageKey).catch(() => undefined);
      throw error;
    }
    if (!operation) {
      await deleteObject(imageKey).catch(() => undefined);
      await deleteObject(candidateKey).catch(() => undefined);
      throw invalid('Não foi possível registrar a tentativa de assinatura.', 503);
    }
    if (operation.candidateObjectKey !== candidateKey) await deleteObject(candidateKey).catch(() => undefined);
    if (operation.signatureImageObjectKey !== imageKey) await deleteObject(imageKey).catch(() => undefined);
    if (operation.requestHash !== requestHash) throw invalid('IDEMPOTENCY_KEY_REUSED', 409);
    found = { operation, context, document, previewId };
  }
  if (!('operation' in found) || !found.operation) throw invalid('Operação de assinatura inválida.');
  if (found.operation.status === 'confirmed') return signatureResult(db, found.context.participant.tenantId, found.context.participant.processId);
  if (found.operation.status === 'rejected') throw invalid('Esta operação de assinatura foi rejeitada.', 409);
  if (found.operation.status === 'stale') {
    const current = (await db.select({ document: appliedDocuments, revision: appliedDocumentRevisions }).from(appliedDocuments).innerJoin(appliedDocumentRevisions, and(eq(appliedDocumentRevisions.tenantId, appliedDocuments.tenantId), eq(appliedDocumentRevisions.id, appliedDocuments.currentRevisionId))).where(and(eq(appliedDocuments.tenantId, found.context.participant.tenantId), eq(appliedDocuments.id, found.operation.documentId))))[0];
    const error = invalid('STALE_DOCUMENT_REVISION', 409) as Error & { code?: string; currentRevisionId?: string; currentVersion?: number };
    error.code = 'STALE_DOCUMENT_REVISION';
    if (current) { error.currentRevisionId = current.revision.id; error.currentVersion = current.revision.version; }
    throw error;
  }
  const operation = found.operation;
  const promoted = await db.transaction(async (tx) => {
    const latestContext = token.startsWith('participant:')
      ? await lockedParticipantContext(tx, token.slice('participant:'.length), actor!)
      : await lockedTokenContext(tx, token, true);
    await tx.execute(sql`select id from applied_documents where tenant_id = ${found.context.participant.tenantId} and id = (select id from applied_documents where tenant_id = ${found.context.participant.tenantId} and followup_contract_id = ${found.context.contract.id}) for update`);
    const document = await currentDocument(tx, found.context.participant.tenantId, found.context.contract.id);
    await verifyObjectBytes(operation.candidateObjectKey, operation.candidateHash, operation.candidateSize);
    if (operation.signatureImageObjectKey) {
      const imageBytes = await downloadObjectBytes(operation.signatureImageObjectKey);
      if (hashBytes(imageBytes) !== operation.signatureImageHash) throw invalid('A evidência da assinatura não corresponde aos metadados.', 503);
    }
    if (document.revision.id !== operation.baseRevisionId) {
      await tx.update(signatureOperations).set({ status: 'stale', staleReason: 'STALE_DOCUMENT_REVISION' }).where(and(eq(signatureOperations.id, operation.id), eq(signatureOperations.status, 'prepared')));
      await tx.insert(signatureEvents).values({ tenantId: found.context.participant.tenantId, participantId: found.context.participant.id, type: 'stale', metadata: { operationId: operation.id, reason: 'STALE_DOCUMENT_REVISION', currentRevisionId: document.revision.id, currentVersion: document.revision.version } });
      return { stale: true as const, currentRevisionId: document.revision.id, currentVersion: document.revision.version };
    }
    if (latestContext.participant.status !== 'pending' || latestContext.process.status !== 'pending' || terminalFollowup(latestContext.followup.status)) {
      await tx.update(signatureOperations).set({ status: 'rejected', staleReason: 'SIGNATURE_PROCESS_NOT_ACTIVE' }).where(and(eq(signatureOperations.id, operation.id), eq(signatureOperations.status, 'prepared')));
      throw invalid('O processo de assinatura não está mais disponível.', 409);
    }
    const candidateRevisionId = randomUUID();
    const revisionRows = await tx.insert(appliedDocumentRevisions).values({ id: candidateRevisionId, tenantId: found.context.participant.tenantId, documentId: document.document.id, version: document.revision.version + 1, parentRevisionId: document.revision.id, objectKey: operation.candidateObjectKey, contentHash: operation.candidateHash, contentSize: operation.candidateSize, origin: 'local_handwritten' }).returning() as any[];
    if (found.previewId) await tx.update(signaturePreviewCandidates).set({ consumedAt: new Date() }).where(and(eq(signaturePreviewCandidates.id, found.previewId), isNull(signaturePreviewCandidates.consumedAt)));
    const revision = revisionRows[0];
    if (!revision) throw invalid('Não foi possível registrar a revisão do documento.', 503);
    const updatedRows = await tx.update(appliedDocuments).set({ currentRevisionId: revision.id }).where(and(eq(appliedDocuments.tenantId, found.context.participant.tenantId), eq(appliedDocuments.id, document.document.id), eq(appliedDocuments.currentRevisionId, document.revision.id))).returning() as any[];
    if (!updatedRows[0]) throw invalid('STALE_DOCUMENT_REVISION', 409);
    const evidence = encryptValue(JSON.stringify({ placement: operation.placement, acceptanceText: operation.acceptanceText, candidateHash: operation.candidateHash, baseRevisionId: operation.baseRevisionId, fingerprint: operation.fingerprint }), evidenceAad(found.context.participant.tenantId, found.context.participant.id));
    const signatureRevisionRows = await tx.insert(signatureRevisions).values({ tenantId: found.context.participant.tenantId, participantId: found.context.participant.id, revision: found.context.participant.latestRevision + 1, evidenceCiphertext: evidence.ciphertext, evidenceNonce: evidence.nonce, evidenceKeyVersion: evidence.keyVersion, operationId: operation.id, documentRevisionId: revision.id, method: 'local_handwritten', placement: operation.placement, signatureImageHash: operation.signatureImageHash }).returning() as any[];
    await tx.insert(signatureEvidence).values({ tenantId: found.context.participant.tenantId, participantId: found.context.participant.id, documentId: document.document.id, documentRevisionId: revision.id, operationId: operation.id, eventType: found.context.participant.role === 'professional' ? 'professional_confirmation' : 'local_confirmation', collectorVersion: normalizedEv.collectorVersion, normalizationVersion: normalizedEv.normalizationVersion, attributes: normalizedEv.attributes, unavailableAttributes: normalizedEv.unavailableAttributes, normalizedRepresentation: normalizedEv.normalizedRepresentation, digest: normalizedEv.digest, observedIp: operation.observedIp, observedAt: operation.evidenceReceivedAt ?? new Date() });
    const signatureRevision = signatureRevisionRows[0];
    if (!signatureRevision) throw invalid('Não foi possível registrar a assinatura.', 503);
    await tx.insert(signatureEvents).values({ tenantId: found.context.participant.tenantId, participantId: found.context.participant.id, revisionId: signatureRevision.id, type: 'signed', metadata: { operationId: operation.id, documentRevisionId: revision.id, method: 'local_handwritten' } });
    const signedAt = new Date();
    await tx.update(signatureParticipants).set({ status: 'signed', signedAt, latestRevision: signatureRevision.revision, updatedAt: signedAt, identitySnapshot: found.context.participant.identitySnapshot }).where(and(eq(signatureParticipants.tenantId, found.context.participant.tenantId), eq(signatureParticipants.id, found.context.participant.id), eq(signatureParticipants.status, 'pending')));
    if (found.context.token) await tx.update(signatureTokens).set({ revokedAt: signedAt }).where(and(eq(signatureTokens.tenantId, found.context.participant.tenantId), eq(signatureTokens.id, found.context.token.id)));
    await tx.update(signatureOperations).set({ status: 'confirmed', confirmedAt: signedAt }).where(and(eq(signatureOperations.tenantId, found.context.participant.tenantId), eq(signatureOperations.id, operation.id), eq(signatureOperations.status, 'prepared')));
    return { result: await signatureResult(tx, found.context.participant.tenantId, found.context.participant.processId) };
  });
  if ('stale' in promoted) {
    const error = invalid('STALE_DOCUMENT_REVISION', 409) as Error & { currentRevisionId?: string; currentVersion?: number; code?: string };
    error.code = 'STALE_DOCUMENT_REVISION'; error.currentRevisionId = promoted.currentRevisionId; error.currentVersion = promoted.currentVersion;
    throw error;
  }
  return promoted.result;
}
async function signatureResult(tx: any, tenantId: string, processId: string) {
  const process = (await tx.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, processId))))[0];
  const participants = await tx.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.processId, processId)));
  const patient = participants.find((p: any) => p.role === 'patient');
  const professional = participants.find((p: any) => p.role === 'professional');
  const bothSigned = patient?.status === 'signed' && professional?.status === 'signed';
  if (process?.status === 'pending' && bothSigned) await tx.update(signatureProcesses).set({ status: 'completed', updatedAt: new Date() }).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, processId), eq(signatureProcesses.status, 'pending')));
  const processAfter = (await tx.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, processId))))[0];
  const contract = processAfter && (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, processAfter.followupContractId))))[0];
  if (!contract) return { signed: true };
  if (patient?.status === 'signed') await tx.update(followupContracts).set({ patientSignedAt: patient.signedAt }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, contract.id)));
  if (professional?.status === 'signed') await tx.update(followupContracts).set({ professionalSignedAt: professional.signedAt }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, contract.id)));
  if (bothSigned) await tx.update(followupContracts).set({ status: 'signed' }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, contract.id)));
  const requiredContracts = await tx.select({ id: followupContracts.id }).from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.followupId, contract.followupId), eq(followupContracts.required, true)));
  const signedRequired = await tx.select({ id: followupContracts.id }).from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.followupId, contract.followupId), eq(followupContracts.required, true), sql`${followupContracts.patientSignedAt} is not null`));
  const followup = (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, contract.followupId))))[0];
  const activated = patient?.status === 'signed' && requiredContracts.length > 0 && requiredContracts.length === signedRequired.length && followup?.status === 'idle';
  if (activated) await tx.update(followups).set({ status: 'active', updatedAt: new Date() }).where(and(eq(followups.tenantId, tenantId), eq(followups.id, contract.followupId), eq(followups.status, 'idle')));
  return { signed: true, followupId: contract.followupId, activated: Boolean(activated), processCompleted: bothSigned };
}

async function readDocumentBytes(document: { key: string; hash: string; size: number }) {
  const bytes = await downloadObjectBytes(document.key);
  if (bytes.byteLength !== document.size || hashBytes(bytes) !== document.hash.toLowerCase()) throw invalid('A revisão do PDF não corresponde aos metadados.', 409);
  return bytes;
}

export async function readSignaturePdf(token: string, actor?: ClinicSignatureActor) {
  const found = await getDatabase().transaction(async (tx) => {
    const context = await lockedTokenContext(tx, token);
    if (context.participant.role === 'patient' && !context.token.phoneVerifiedAt) throw invalid('Os quatro últimos dígitos do telefone devem ser confirmados antes de visualizar o PDF.', 403);
    if (context.participant.role === 'professional' && (!actor || actor.tenantId !== context.participant.tenantId)) throw invalid('A assinatura do representante deve usar a sessão autenticada da clínica.', 403);
    const document = await currentDocument(tx, context.participant.tenantId, context.contract.id);
    return { key: document.revision.objectKey, hash: document.revision.contentHash, size: document.revision.contentSize };
  });
  return readDocumentBytes({ key: found.key, hash: found.hash, size: found.size });
}

export async function readSignaturePdfForParticipant(participantId: string, actor: ClinicSignatureActor) {
  const found = await getDatabase().transaction(async (tx) => {
    const context = await lockedParticipantContext(tx, participantId, actor);
    const document = await currentDocument(tx, actor.tenantId, context.contract.id);
    return { key: document.revision.objectKey, hash: document.revision.contentHash, size: document.revision.contentSize };
  });
  return readDocumentBytes({ key: found.key, hash: found.hash, size: found.size });
}

export async function signAsClinicRepresentative(participantId: string, input: unknown, actor: ClinicSignatureActor, reqContext?: { ip?: string }) {
  const issued = await issueSignatureToken(actor.tenantId, participantId);
  if ('alreadySigned' in issued) return { alreadySigned: true };
  return signWithToken(`participant:${participantId}`, input, actor, reqContext);
}
export async function previewSignatureAsClinicRepresentative(participantId: string, input: unknown, actor: ClinicSignatureActor) {
  return previewSignature(`participant:${participantId}`, input, actor);
}

export async function listPendingSignatures(tenantId: string) {
  const rows = await getDatabase().select({ participant: signatureParticipants, process: signatureProcesses, contract: followupContracts, followup: followups, patient: patients }).from(signatureParticipants).innerJoin(signatureProcesses, and(eq(signatureProcesses.tenantId, signatureParticipants.tenantId), eq(signatureProcesses.id, signatureParticipants.processId))).innerJoin(followupContracts, and(eq(followupContracts.tenantId, signatureProcesses.tenantId), eq(followupContracts.id, signatureProcesses.followupContractId))).innerJoin(followups, and(eq(followups.tenantId, followupContracts.tenantId), eq(followups.id, followupContracts.followupId))).innerJoin(patients, and(eq(patients.tenantId, followups.tenantId), eq(patients.id, followups.patientId))).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.status, 'pending'), eq(signatureProcesses.status, 'pending'), sql`${followups.status} not in ('cancelled', 'completed')`)).orderBy(desc(signatureParticipants.createdAt));
  return rows.map((row: any) => ({ participantId: row.participant.id, role: row.participant.role, status: row.participant.status, followupId: row.contract.followupId, contractId: row.contract.id, title: row.contract.titleSnapshot, blocking: row.participant.role === 'patient' && row.contract.required, patient: { id: row.patient.id, fullName: row.patient.fullName } }));
}
