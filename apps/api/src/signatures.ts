import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  appliedDocuments, appliedDocumentRevisions, buildPatientAad, buildProtectedAad, decryptValue, encryptValue, getDatabase, followupContracts, followups, patients,
  signatureEvents, signatureEvidence, signatureExternalAttempts, signatureExternalReceipts, signatureOperations, signatureParticipants, signatureProcesses, signatureRevisions, signatureTokens, signaturePreviewCandidates, tenants,
} from '@clinicare/db';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createIncrementalSignaturePdf, validatePlacement, type PdfPlacement } from './pdf-mutation';
import { normalizeEvidence } from './signature-evidence';
import { loadTrustedRootFiles, loadTrustedRootsFromEnv, revalidateEmbeddedSignatures, validateExternalReturn, type ExpectedSigner } from './external-validation';
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

/**
 * Congela a identidade operacional do representante a partir da sessão
 * autenticada (Issue #25): userId, nome, e-mail, tenant, clínica e papel.
 * O tenant é a clínica neste modelo; o nome exibível vem da tabela de
 * tenants. Alterações posteriores no perfil não modificam este registro
 * histórico. Nunca usa identidade declarada no corpo da requisição.
 */
async function professionalSnapshot(executor: any, actor: ClinicSignatureActor) {
  const tenantRow = (await executor.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, actor.tenantId)))[0];
  return {
    role: 'professional',
    userId: actor.userId,
    name: actor.user.name,
    email: actor.user.email,
    tenantId: actor.tenantId,
    clinic: tenantRow?.name ?? null,
  };
}

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

/**
 * Contexto de LEITURA (entregáveis pós-assinatura — Issue #28): prova posse
 * do token (hash), verificação telefônica persistente, expiração e tenant
 * ativo, sem exigir processo pendente. Links continuam servindo histórico
 * e PDFs após a conclusão; poder de ASSINATURA continua no contexto
 * estrito (preview/confirm/export/import). Refresh continua invalidando o
 * token antigo para assinatura; a verificação persiste no registro.
 */
async function lockedTokenReadContext(tx: any, rawToken: string) {
  const candidate = await tokenParticipant(tx, rawToken, true);
  const [tenant] = await tx.select({ active: tenants.active }).from(tenants).where(eq(tenants.id, candidate.participant.tenantId));
  if (!tenant?.active) throw invalid('Link inválido, expirado ou revogado.', 404);
  if (!candidate.token || candidate.token.expiresAt <= new Date()) throw invalid('Link inválido, expirado ou revogado.', 404);
  // Revogação encerra o poder de assinatura, mas preserva entregáveis de quem
  // já assinou. Links rotacionados (refresh) ou cancelados com participante
  // pendente continuam inválidos para leitura pública; o painel cobre esses
  // casos via sessão autenticada.
  if (candidate.token.revokedAt && candidate.participant.status !== 'signed') {
    throw invalid('Link inválido, expirado ou revogado.', 404);
  }
  const tenantId = candidate.participant.tenantId;
  const participant = (await tx.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.id, candidate.participant.id))))[0];
  const process = (await tx.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, candidate.participant.processId))))[0];
  const contract = process && (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, process.followupContractId))))[0];
  const followup = contract && (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, contract.followupId))))[0];
  if (!participant || !process || !contract || !followup) throw invalid('Contrato aplicado não encontrado.', 404);
  return { token: candidate.token, participant, process, contract, followup };
}

/**
 * Contexto de LEITURA do painel: participante existe no tenant da sessão,
 * sem exigir processo pendente. Downloads e histórico sobrevivem à
 * conclusão e ao cancelamento; mutações continuam no contexto estrito.
 */
async function lockedParticipantReadContext(tx: any, participantId: string, actor: ClinicSignatureActor) {
  if (!uuid.test(participantId)) throw invalid('Participante inválido.', 400);
  const participant = (await tx.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, actor.tenantId), eq(signatureParticipants.id, participantId))))[0];
  if (!participant) throw invalid('Participante não encontrado.', 404);
  const process = (await tx.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, actor.tenantId), eq(signatureProcesses.id, participant.processId))))[0];
  const contract = process && (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, actor.tenantId), eq(followupContracts.id, process.followupContractId))))[0];
  const followup = contract && (await tx.select().from(followups).where(and(eq(followups.tenantId, actor.tenantId), eq(followups.id, contract.followupId))))[0];
  if (!process || !contract || !followup) throw invalid('Contrato aplicado não encontrado.', 404);
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
    const found = await lockedTokenReadContext(tx, token);
    if (found.participant.role === 'professional') throw invalid('O representante deve acessar pelo painel autenticado da clínica.', 403);
    if (found.participant.role === 'patient' && !found.token.phoneVerifiedAt) {
      return { participantId: found.participant.id, role: found.participant.role, status: 'verification_required', expiresAt: found.token.expiresAt, phoneVerificationRequired: true };
    }
    const { participant, token: tokenRow, contract } = found;
    const content = contract.contentCiphertext ? decryptValue({ ciphertext: contract.contentCiphertext, nonce: contract.contentNonce!, keyVersion: contract.contentKeyVersion! }, contentAad(participant.tenantId, contract.id, contract.contentKeyVersion!)) : null;
    const document = await currentDocument(tx, participant.tenantId, contract.id);
    const externalAncestor = (await tx.select({ id: appliedDocumentRevisions.id }).from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, participant.tenantId), eq(appliedDocumentRevisions.documentId, document.document.id), eq(appliedDocumentRevisions.origin, 'govbr_external'))).limit(1))[0];
    return { participantId: participant.id, role: participant.role, status: participant.status, expiresAt: tokenRow.expiresAt, hasExternalSignatures: !!externalAncestor, document: { id: document.document.id, revisionId: document.revision.id, version: document.revision.version, hash: document.revision.contentHash, size: document.revision.contentSize, url: `/public/signatures/${token}/pdf` }, contract: { id: contract.id, followupId: contract.followupId, title: contract.titleSnapshot, version: contract.contractVersion, content, sourceObjectKey: contract.sourceObjectKey } };
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
        const representativeSnapshot = context.participant.role === 'professional' && actor
          ? await professionalSnapshot(tx, actor)
          : null;
        const rows = await tx.insert(signatureOperations).values({ tenantId: context.participant.tenantId, participantId: context.participant.id, documentId: document.document.id, baseRevisionId: document.revision.id, candidateObjectKey: candidateKey, candidateHash, candidateSize, signatureImageObjectKey: imageKey, placement: prepared.placement, idempotencyKey: prepared.idempotencyKey, requestHash, signatureImageHash, acceptanceText: prepared.acceptanceText, identitySnapshot: representativeSnapshot ?? context.participant.identitySnapshot, fingerprint: prepared.fingerprint, fingerprintCollectorVersion: normalizedEv.collectorVersion, fingerprintNormalizationVersion: normalizedEv.normalizationVersion, fingerprintDigest: normalizedEv.digest, observedIp: reqContext?.ip ?? null, evidenceReceivedAt: new Date(), status: 'prepared' }).onConflictDoNothing({ target: [signatureOperations.tenantId, signatureOperations.participantId, signatureOperations.idempotencyKey] }).returning() as any[];
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
      await tx.insert(signatureEvents).values({ tenantId: found.context.participant.tenantId, participantId: found.context.participant.id, type: 'rejected', metadata: { operationId: operation.id, reason: 'SIGNATURE_PROCESS_NOT_ACTIVE' } });
      throw invalid('O processo de assinatura não está mais disponível.', 409);
    }
    try {
      await revalidateExternalAncestors(tx, found.context.participant.tenantId, document.document.id, document.revision);
    } catch (error) {
      await tx.update(signatureOperations).set({ status: 'rejected', staleReason: 'EXTERNAL_REVALIDATION_FAILED' }).where(and(eq(signatureOperations.id, operation.id), eq(signatureOperations.status, 'prepared')));
      await tx.insert(signatureEvents).values({ tenantId: found.context.participant.tenantId, participantId: found.context.participant.id, type: 'revalidation_failed', metadata: { operationId: operation.id, reason: (error as Error & { code?: string }).code ?? 'EXTERNAL_REVALIDATION_FAILED' } });
      throw error;
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
  if (process?.status === 'pending' && bothSigned) {
    const completedRows = (await tx.update(signatureProcesses).set({ status: 'completed', updatedAt: new Date() }).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, processId), eq(signatureProcesses.status, 'pending'))).returning() as any[]);
    if (completedRows[0]) {
      for (const participant of participants) {
        await tx.insert(signatureEvents).values({ tenantId, participantId: participant.id, type: 'completed', metadata: { processId, patientSignedAt: patient?.signedAt ?? null, professionalSignedAt: professional?.signedAt ?? null } });
      }
    }
  }
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

/**
 * Revalida assinaturas externas embutidas antes de promover qualquer
 * mutação posterior (Issue #27): se a cadeia do documento contém revisão
 * externa, cada assinatura embutida no HEAD precisa continuar íntegra
 * (cobertura, digest, CMS, validade; cadeia quando há raízes
 * configuradas). Falha fechada: bloqueia a promoção e mantém a revisão
 * anterior intacta, sem nenhum fallback destrutivo.
 */
async function revalidateExternalAncestors(tx: any, tenantId: string, documentId: string, headRevision: { id: string; objectKey: string; contentHash: string; contentSize: number }) {
  const revisions = await tx.select({ id: appliedDocumentRevisions.id, origin: appliedDocumentRevisions.origin }).from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, documentId)));
  if (!revisions.some((revision: any) => revision.origin === 'govbr_external')) return;
  const headBytes = await readDocumentBytes({ key: headRevision.objectKey, hash: headRevision.contentHash, size: headRevision.contentSize });
  const result = await revalidateEmbeddedSignatures(headBytes, { trustedRootPems: await externalTrustedRoots() });
  if (!result.ok) {
    const error = invalid(`A assinatura externa existente não pôde ser revalidada (${result.reason}); a operação foi bloqueada e a revisão permanece intacta.`, 409) as Error & { code?: string };
    error.code = 'EXTERNAL_REVALIDATION_FAILED';
    throw error;
  }
}

export async function readSignaturePdf(token: string, actor?: ClinicSignatureActor) {
  const found = await getDatabase().transaction(async (tx) => {
    const context = await lockedTokenReadContext(tx, token);
    if (context.participant.role === 'patient' && !context.token.phoneVerifiedAt) throw invalid('Os quatro últimos dígitos do telefone devem ser confirmados antes de visualizar o PDF.', 403);
    if (context.participant.role === 'professional') throw invalid('O representante deve acessar pelo painel autenticado da clínica.', 403);
    const document = await currentDocument(tx, context.participant.tenantId, context.contract.id);
    return { key: document.revision.objectKey, hash: document.revision.contentHash, size: document.revision.contentSize };
  });
  return readDocumentBytes({ key: found.key, hash: found.hash, size: found.size });
}

export async function readSignaturePdfForParticipant(participantId: string, actor: ClinicSignatureActor) {
  const found = await getDatabase().transaction(async (tx) => {
    const context = await lockedParticipantReadContext(tx, participantId, actor);
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

/* ------------------------------------------------------------------ */
/* Assinatura externa (GOV.BR) — Issue #26                             */
/*                                                                     */
/* Fluxo exportar → assinar fora → importar → aceitar. A aplicação     */
/* nunca faz login no portal, nunca recebe credenciais e nunca aceita  */
/* status declarado pelo navegador: a classificação do retorno deriva */
/* exclusivamente do validador criptográfico real                      */
/* (`external-validation.ts`). Somente `validated` promove revisão.   */
/* ------------------------------------------------------------------ */

const externalReservationMs = 24 * 3600_000;
const externalImportMaxBytes = 15 * 1024 * 1024;

export const externalValidationPt: Record<string, string> = {
  validated: 'validada',
  invalid: 'inválida',
  indeterminate: 'indeterminada',
  unsupported: 'não suportada',
};

async function externalTrustedRoots(): Promise<string[]> {
  const fromEnv = loadTrustedRootsFromEnv(process.env as Record<string, string | undefined>);
  const file = (process.env as Record<string, string | undefined>).GOVBR_TRUSTED_ROOTS_FILE;
  if (!file) return fromEnv;
  return [...fromEnv, ...(await loadTrustedRootFiles([file]))];
}

function externalExportInput(input: unknown) {
  if (!input || typeof input !== 'object') throw invalid('Exportação inválida.');
  const value = input as Record<string, unknown>;
  if (typeof value.documentId !== 'string' || !uuid.test(value.documentId)) throw invalid('Documento inválido.');
  if (typeof value.baseRevisionId !== 'string' || !uuid.test(value.baseRevisionId)) throw invalid('Revisão-base inválida.');
  if (typeof value.idempotencyKey !== 'string' || value.idempotencyKey.trim().length < 8 || value.idempotencyKey.length > 200) throw invalid('Chave de idempotência inválida.');
  return { documentId: value.documentId, baseRevisionId: value.baseRevisionId, idempotencyKey: value.idempotencyKey, fingerprint: fingerprintValue(value.fingerprint) };
}

function externalConfirmInput(input: unknown) {
  if (!input || typeof input !== 'object') throw invalid('Confirmação externa inválida.');
  const value = input as Record<string, unknown>;
  if (typeof value.attemptId !== 'string' || !uuid.test(value.attemptId)) throw invalid('Tentativa inválida.');
  if (typeof value.idempotencyKey !== 'string' || value.idempotencyKey.trim().length < 8 || value.idempotencyKey.length > 200) throw invalid('Chave de idempotência inválida.');
  const acceptanceText = typeof value.acceptanceText === 'string' ? value.acceptanceText.trim() : '';
  if (value.confirmed !== true || !acceptanceText) throw invalid('A confirmação explícita e o texto de aceite são obrigatórios.');
  return { attemptId: value.attemptId, idempotencyKey: value.idempotencyKey, acceptanceText, fingerprint: fingerprintValue(value.fingerprint) };
}

type ExternalAccess = { participant: any; contract: any; process: any; followup: any; token: any };

async function externalAccessContext(tx: any, access: string, actor?: ClinicSignatureActor): Promise<ExternalAccess> {
  const found = access.startsWith('participant:')
    ? await lockedParticipantContext(tx, access.slice('participant:'.length), actor!)
    : await lockedTokenContext(tx, access);
  if (found.participant.role === 'patient' && !found.token?.phoneVerifiedAt) {
    throw invalid('Os quatro últimos dígitos do telefone devem ser confirmados antes da assinatura externa.', 403);
  }
  return { participant: found.participant, contract: found.contract, process: found.process, followup: found.followup, token: (found as { token?: unknown }).token ?? null };
}

/** Variante por identificadores para a fase de validação fora de transação. */
async function expectedExternalSignerById(tx: any, tenantId: string, participantId: string, contractId: string, actor?: ClinicSignatureActor): Promise<ExpectedSigner> {
  const participant = (await tx.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.id, participantId))))[0];
  if (!participant) return {};
  if (participant.role === 'professional') {
    return actor ? { emails: [actor.user.email] } : {};
  }
  const contract = (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, contractId))))[0];
  if (!contract) return {};
  return expectedExternalSigner(tx, participant, contract, actor);
}
/** Identificadores verificados esperados do signatário (nunca nome isolado). */
async function expectedExternalSigner(tx: any, participant: any, contract: any, actor?: ClinicSignatureActor): Promise<ExpectedSigner> {
  if (participant.role === 'professional') {
    return actor ? { emails: [actor.user.email] } : {};
  }
  const followup = (await tx.select().from(followups).where(and(eq(followups.tenantId, participant.tenantId), eq(followups.id, contract.followupId))))[0];
  if (!followup) return {};
  const patient = (await tx.select().from(patients).where(and(eq(patients.tenantId, participant.tenantId), eq(patients.id, followup.patientId))))[0];
  if (!patient?.cpfCiphertext || !patient?.cpfNonce || patient?.cpfKeyVersion == null) return {};
  try {
    const cpf = decryptValue({ ciphertext: patient.cpfCiphertext, nonce: patient.cpfNonce, keyVersion: patient.cpfKeyVersion }, buildPatientAad(participant.tenantId, patient.id, 'cpf', patient.cpfKeyVersion));
    const digits = cpf.replace(/\D/g, '');
    return digits.length === 11 ? { cpfDigits: digits } : {};
  } catch {
    return {};
  }
}

function liveExternalAttempt(attempt: any) {
  if (!attempt) throw invalid('Tentativa externa não encontrada.', 404);
  if (attempt.lifecycleStatus === 'cancelled') throw invalid('A tentativa externa foi cancelada.', 409);
  if (attempt.lifecycleStatus === 'completed') throw invalid('A tentativa externa já foi concluída.', 409);
  if (attempt.lifecycleStatus === 'expired' || attempt.exportExpiresAt <= new Date()) {
    throw invalid('A reserva de exportação expirou.', 409);
  }
  return attempt;
}

export async function exportExternalRevision(access: string, input: unknown, actor?: ClinicSignatureActor, reqContext?: { ip?: string }) {
  const prepared = externalExportInput(input);
  if (access.startsWith('participant:') && !actor) throw invalid('Autenticação necessária.', 401);
  const db = getDatabase();
  const normalized = normalizeEvidence(prepared.fingerprint);
  return db.transaction(async (tx) => {
    const found = await externalAccessContext(tx, access, actor);
    const document = await currentDocument(tx, found.participant.tenantId, found.contract.id);
    if (document.document.id !== prepared.documentId || document.revision.id !== prepared.baseRevisionId) {
      const error = invalid('STALE_DOCUMENT_REVISION', 409) as Error & { code?: string; currentRevisionId?: string; currentVersion?: number };
      error.code = 'STALE_DOCUMENT_REVISION'; error.currentRevisionId = document.revision.id; error.currentVersion = document.revision.version;
      throw error;
    }
    const existing = (await tx.select().from(signatureExternalAttempts).where(and(eq(signatureExternalAttempts.tenantId, found.participant.tenantId), eq(signatureExternalAttempts.participantId, found.participant.id), eq(signatureExternalAttempts.idempotencyKey, prepared.idempotencyKey))))[0];
    if (existing) {
      if (existing.documentId !== prepared.documentId || existing.baseRevisionId !== prepared.baseRevisionId) throw invalid('IDEMPOTENCY_KEY_REUSED', 409);
      return {
        attemptId: existing.id, exportHash: existing.exportHash, exportSize: existing.exportSize,
        expiresAt: existing.exportExpiresAt, lifecycleStatus: existing.lifecycleStatus,
      };
    }
    const expiresAt = new Date(Date.now() + externalReservationMs);
    const rows = (await tx.insert(signatureExternalAttempts).values({
      tenantId: found.participant.tenantId, participantId: found.participant.id, documentId: document.document.id,
      baseRevisionId: document.revision.id, provider: 'govbr', lifecycleStatus: 'reserved', idempotencyKey: prepared.idempotencyKey,
      exportObjectKey: document.revision.objectKey, exportHash: document.revision.contentHash, exportSize: document.revision.contentSize,
      exportExpiresAt: expiresAt, exportFingerprint: prepared.fingerprint,
    }).onConflictDoNothing({ target: [signatureExternalAttempts.tenantId, signatureExternalAttempts.participantId, signatureExternalAttempts.idempotencyKey] }).returning() as any[]);
    const attempt = rows[0] ?? (await tx.select().from(signatureExternalAttempts).where(and(eq(signatureExternalAttempts.tenantId, found.participant.tenantId), eq(signatureExternalAttempts.participantId, found.participant.id), eq(signatureExternalAttempts.idempotencyKey, prepared.idempotencyKey))))[0];
    if (!attempt) throw invalid('Não foi possível reservar a exportação.', 503);
    if (attempt.documentId !== prepared.documentId || attempt.baseRevisionId !== prepared.baseRevisionId) throw invalid('IDEMPOTENCY_KEY_REUSED', 409);
    await tx.insert(signatureEvidence).values({
      tenantId: found.participant.tenantId, participantId: found.participant.id, documentId: document.document.id,
      documentRevisionId: document.revision.id, externalAttemptId: attempt.id,
      eventType: found.participant.role === 'professional' ? 'external_export_representative' : 'external_export',
      collectorVersion: normalized.collectorVersion, normalizationVersion: normalized.normalizationVersion,
      attributes: normalized.attributes, unavailableAttributes: normalized.unavailableAttributes,
      normalizedRepresentation: normalized.normalizedRepresentation, digest: normalized.digest,
      observedIp: reqContext?.ip ?? null, observedAt: new Date(),
    });
    return {
      attemptId: attempt.id, exportHash: attempt.exportHash, exportSize: attempt.exportSize,
      expiresAt: attempt.exportExpiresAt, lifecycleStatus: attempt.lifecycleStatus,
    };
  });
}

export async function downloadExternalExport(access: string, attemptId: string, actor?: ClinicSignatureActor) {
  if (!uuid.test(attemptId)) throw invalid('Tentativa inválida.');
  if (access.startsWith('participant:') && !actor) throw invalid('Autenticação necessária.', 401);
  const found = await getDatabase().transaction(async (tx) => {
    const context = await externalAccessContext(tx, access, actor);
    const attempt = (await tx.select().from(signatureExternalAttempts).where(and(eq(signatureExternalAttempts.tenantId, context.participant.tenantId), eq(signatureExternalAttempts.id, attemptId), eq(signatureExternalAttempts.participantId, context.participant.id))))[0];
    liveExternalAttempt(attempt);
    return { key: attempt.exportObjectKey, hash: attempt.exportHash, size: attempt.exportSize };
  });
  return readDocumentBytes({ key: found.key, hash: found.hash, size: found.size });
}

export async function importExternalReturn(access: string, input: unknown, actor?: ClinicSignatureActor, reqContext?: { ip?: string }) {
  if (!input || typeof input !== 'object') throw invalid('Importação inválida.');
  const value = input as Record<string, unknown>;
  if (typeof value.attemptId !== 'string' || !uuid.test(value.attemptId)) throw invalid('Tentativa inválida.');
  if (typeof value.pdfBase64 !== 'string' || value.pdfBase64.length === 0) throw invalid('Arquivo PDF ausente.');
  if (access.startsWith('participant:') && !actor) throw invalid('Autenticação necessária.', 401);
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = Uint8Array.from(Buffer.from(value.pdfBase64, 'base64'));
  } catch {
    throw invalid('Arquivo PDF inválido.');
  }
  if (pdfBytes.byteLength === 0 || pdfBytes.byteLength > externalImportMaxBytes) throw invalid('Arquivo PDF inválido.');
  const normalized = normalizeEvidence(fingerprintValue(value.fingerprint));
  const db = getDatabase();
  const importHash = hashBytes(pdfBytes);
  // Fase 1 (leitura curta): contexto, tentativa viva e idempotência de replay.
  const prepared = await db.transaction(async (tx) => {
    const found = await externalAccessContext(tx, access, actor);
    const attempt = (await tx.select().from(signatureExternalAttempts).where(and(eq(signatureExternalAttempts.tenantId, found.participant.tenantId), eq(signatureExternalAttempts.id, value.attemptId), eq(signatureExternalAttempts.participantId, found.participant.id))))[0];
    liveExternalAttempt(attempt);
    // Repetição do mesmo retorno é idempotente em qualquer estado vivo da
    // tentativa; um retorno diferente nunca substitui o primeiro.
    const existingReceipt = (await tx.select().from(signatureExternalReceipts).where(and(eq(signatureExternalReceipts.tenantId, found.participant.tenantId), eq(signatureExternalReceipts.attemptId, attempt.id))))[0] ?? null;
    if (existingReceipt) {
      if (existingReceipt.contentHash !== importHash) throw invalid('A tentativa externa já recebeu um retorno diferente.', 409);
      return { replay: true as const, receiptId: existingReceipt.id, attemptId: attempt.id, validationStatus: existingReceipt.validationStatus, reason: (existingReceipt.validationReport as any)?.reason ?? null };
    }
    if (attempt.lifecycleStatus !== 'reserved') throw invalid('A tentativa externa já recebeu um retorno.', 409);
    return {
      replay: false as const,
      tenantId: found.participant.tenantId, participantId: found.participant.id, role: found.participant.role,
      attemptId: attempt.id, documentId: attempt.documentId, baseRevisionId: attempt.baseRevisionId,
      exportRef: { key: attempt.exportObjectKey, hash: attempt.exportHash, size: attempt.exportSize },
      contractId: found.contract.id,
    };
  });
  if (prepared.replay) {
    return {
      receiptId: prepared.receiptId, attemptId: prepared.attemptId,
      validationStatus: externalValidationPt[prepared.validationStatus] ?? prepared.validationStatus,
      reason: prepared.reason,
    };
  }
  // Fase 2 (fora de transação: storage + validação criptográfica, que pode
  // consultar revogação na rede — nunca com locks de linha retidos).
  const exportBytes = await readDocumentBytes(prepared.exportRef);
  const expected = await db.transaction(async (tx) => expectedExternalSignerById(tx, prepared.tenantId, prepared.participantId, prepared.contractId, actor));
  const report = await validateExternalReturn({
    exportBytes,
    returnBytes: pdfBytes,
    trustedRootPems: await externalTrustedRoots(),
    expected,
  });
  const objectKey = randomUUID();
  await uploadObjectBytes(objectKey, pdfBytes, 'application/pdf');
  try {
    await verifyObjectBytes(objectKey, importHash, pdfBytes.byteLength);
  } catch (error) {
    await deleteObject(objectKey).catch(() => undefined);
    throw error;
  }
  // Fase 3 (escrita curta): revalida o estado e registra recebimento.
  return db.transaction(async (tx) => {
    const attempt = (await tx.select().from(signatureExternalAttempts).where(and(eq(signatureExternalAttempts.tenantId, prepared.tenantId), eq(signatureExternalAttempts.id, prepared.attemptId), eq(signatureExternalAttempts.participantId, prepared.participantId))))[0];
    liveExternalAttempt(attempt);
    const racedReceipt = (await tx.select().from(signatureExternalReceipts).where(and(eq(signatureExternalReceipts.tenantId, prepared.tenantId), eq(signatureExternalReceipts.attemptId, attempt.id))))[0] ?? null;
    if (racedReceipt) {
      await deleteObject(objectKey).catch(() => undefined);
      if (racedReceipt.contentHash !== importHash) throw invalid('A tentativa externa já recebeu um retorno diferente.', 409);
      return {
        receiptId: racedReceipt.id, attemptId: attempt.id,
        validationStatus: externalValidationPt[racedReceipt.validationStatus] ?? racedReceipt.validationStatus,
        reason: (racedReceipt.validationReport as any)?.reason ?? null,
      };
    }
    if (attempt.lifecycleStatus !== 'reserved') {
      await deleteObject(objectKey).catch(() => undefined);
      throw invalid('A tentativa externa já recebeu um retorno.', 409);
    }
    const receiptRows = (await tx.insert(signatureExternalReceipts).values({
      tenantId: prepared.tenantId, attemptId: attempt.id, objectKey, contentHash: importHash, contentSize: pdfBytes.byteLength,
      validationStatus: report.status === 'validated' ? 'validated' : report.status === 'invalid' ? 'invalid' : report.status === 'unsupported' ? 'unsupported' : 'indeterminate',
      validationReport: { ...report },
      signerIdentity: report.signer,
      certificateFingerprint: report.certificateFingerprint,
      coveredRevisionIds: [attempt.baseRevisionId],
      detectedSignatureIds: { count: report.detectedSignatureCount, certificateFingerprint: report.certificateFingerprint },
      rejectedReason: report.status === 'validated' ? null : report.reason,
    }).returning() as any[]);
    const receipt = receiptRows[0];
    if (!receipt) {
      await deleteObject(objectKey).catch(() => undefined);
      throw invalid('Não foi possível registrar o recebimento.', 503);
    }
    await tx.update(signatureExternalAttempts).set({
      importObjectKey: objectKey, importHash, importSize: pdfBytes.byteLength, importedAt: new Date(),
      importFingerprint: fingerprintValue(value.fingerprint), lifecycleStatus: 'return_received',
      validationStatus: receipt.validationStatus,
    }).where(and(eq(signatureExternalAttempts.tenantId, prepared.tenantId), eq(signatureExternalAttempts.id, attempt.id)));
    await tx.insert(signatureEvidence).values({
      tenantId: prepared.tenantId, participantId: prepared.participantId, documentId: attempt.documentId,
      documentRevisionId: null, externalAttemptId: attempt.id,
      eventType: prepared.role === 'professional' ? 'external_import_representative' : 'external_import',
      collectorVersion: normalized.collectorVersion, normalizationVersion: normalized.normalizationVersion,
      attributes: normalized.attributes, unavailableAttributes: normalized.unavailableAttributes,
      normalizedRepresentation: normalized.normalizedRepresentation, digest: normalized.digest,
      observedIp: reqContext?.ip ?? null, observedAt: new Date(),
    });
    return {
      receiptId: receipt.id, attemptId: attempt.id,
      validationStatus: externalValidationPt[receipt.validationStatus] ?? receipt.validationStatus,
      reason: report.reason,
      signer: report.signer ? { commonName: report.signer.commonName, emails: report.signer.emails } : null,
      certificateFingerprint: report.certificateFingerprint,
    };
  });
}

export async function confirmExternalReturn(access: string, input: unknown, actor?: ClinicSignatureActor, reqContext?: { ip?: string }) {
  const prepared = externalConfirmInput(input);
  if (access.startsWith('participant:') && !actor) throw invalid('Autenticação necessária.', 401);
  const normalized = normalizeEvidence(prepared.fingerprint);
  const db = getDatabase();
  const operation = await db.transaction(async (tx) => {
    const found = await externalAccessContext(tx, access, actor);
    const attempt = (await tx.select().from(signatureExternalAttempts).where(and(eq(signatureExternalAttempts.tenantId, found.participant.tenantId), eq(signatureExternalAttempts.id, prepared.attemptId), eq(signatureExternalAttempts.participantId, found.participant.id))))[0];
    liveExternalAttempt(attempt);
    if (attempt.lifecycleStatus !== 'return_received') throw invalid('A tentativa externa ainda não recebeu o retorno do GOV.BR.', 409);
    const receipt = (await tx.select().from(signatureExternalReceipts).where(and(eq(signatureExternalReceipts.tenantId, found.participant.tenantId), eq(signatureExternalReceipts.attemptId, attempt.id))))[0];
    if (!receipt) throw invalid('Recebimento externo não encontrado.', 404);
    if (receipt.validationStatus !== 'validated') {
      throw invalid(`O retorno externo está ${externalValidationPt[receipt.validationStatus] ?? receipt.validationStatus} e não pode confirmar a assinatura.`, 409);
    }
    const requestHash = hashJson({ method: 'govbr_external', documentId: attempt.documentId, baseRevisionId: attempt.baseRevisionId, importHash: attempt.importHash, acceptanceText: prepared.acceptanceText, attemptId: attempt.id, receiptId: receipt.id, fingerprint: normalized.normalizedRepresentation });
    const existing = (await tx.select().from(signatureOperations).where(and(eq(signatureOperations.tenantId, found.participant.tenantId), eq(signatureOperations.participantId, found.participant.id), eq(signatureOperations.idempotencyKey, prepared.idempotencyKey))))[0];
    if (existing) {
      if (existing.requestHash !== requestHash) throw invalid('IDEMPOTENCY_KEY_REUSED', 409);
      return existing;
    }
    if (found.participant.role !== 'patient') {
      if (!actor || actor.tenantId !== found.participant.tenantId) throw invalid('A assinatura do representante deve usar a sessão autenticada da clínica.', 403);
    }
    const document = await currentDocument(tx, found.participant.tenantId, found.contract.id);
    if (document.document.id !== attempt.documentId || document.revision.id !== attempt.baseRevisionId) {
      const error = invalid('STALE_DOCUMENT_REVISION', 409) as Error & { code?: string; currentRevisionId?: string; currentVersion?: number };
      error.code = 'STALE_DOCUMENT_REVISION'; error.currentRevisionId = document.revision.id; error.currentVersion = document.revision.version;
      throw error;
    }
    if (found.participant.status === 'signed') {
      const done = await signatureResult(tx, found.participant.tenantId, found.participant.processId);
      return { alreadySigned: true as const, result: done };
    }
    // Revalida a cadeia preservada antes de promover: a base precisa estar
    // íntegra no storage, senão nada é promovido.
    await verifyObjectBytes(attempt.exportObjectKey, attempt.exportHash, attempt.exportSize);
    await verifyObjectBytes(receipt.objectKey, receipt.contentHash, receipt.contentSize);
    const representative = found.participant.role === 'professional' && actor ? await professionalSnapshot(tx, actor) : null;
    const rows = (await tx.insert(signatureOperations).values({
      tenantId: found.participant.tenantId, participantId: found.participant.id, documentId: attempt.documentId,
      baseRevisionId: attempt.baseRevisionId, candidateObjectKey: receipt.objectKey, candidateHash: receipt.contentHash,
      candidateSize: receipt.contentSize, method: 'govbr_external', placement: null, idempotencyKey: prepared.idempotencyKey,
      requestHash, signatureImageHash: null, signatureImageObjectKey: null, acceptanceText: prepared.acceptanceText,
      identitySnapshot: representative ?? found.participant.identitySnapshot,
      fingerprint: prepared.fingerprint, fingerprintCollectorVersion: normalized.collectorVersion,
      fingerprintNormalizationVersion: normalized.normalizationVersion, fingerprintDigest: normalized.digest,
      observedIp: reqContext?.ip ?? null, evidenceReceivedAt: new Date(), status: 'prepared',
    }).onConflictDoNothing({ target: [signatureOperations.tenantId, signatureOperations.participantId, signatureOperations.idempotencyKey] }).returning() as any[]);
    return rows[0] ?? (await tx.select().from(signatureOperations).where(and(eq(signatureOperations.tenantId, found.participant.tenantId), eq(signatureOperations.participantId, found.participant.id), eq(signatureOperations.idempotencyKey, prepared.idempotencyKey))))[0];
  });
  if (!operation) throw invalid('Não foi possível registrar a tentativa externa.', 503);
  if ('alreadySigned' in operation) return operation.result;
  if (operation.status === 'confirmed') return signatureResult(db, operation.tenantId, (await db.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, operation.tenantId), eq(signatureParticipants.id, operation.participantId))))[0]!.processId);
  if (operation.status === 'rejected') throw invalid('Esta operação de assinatura foi rejeitada.', 409);
  if (operation.status === 'stale') {
    const current = (await db.select({ document: appliedDocuments, revision: appliedDocumentRevisions }).from(appliedDocuments).innerJoin(appliedDocumentRevisions, and(eq(appliedDocumentRevisions.tenantId, appliedDocuments.tenantId), eq(appliedDocumentRevisions.id, appliedDocuments.currentRevisionId))).where(and(eq(appliedDocuments.tenantId, operation.tenantId), eq(appliedDocuments.id, operation.documentId))))[0];
    const error = invalid('STALE_DOCUMENT_REVISION', 409) as Error & { code?: string; currentRevisionId?: string; currentVersion?: number };
    error.code = 'STALE_DOCUMENT_REVISION';
    if (current) { error.currentRevisionId = current.revision.id; error.currentVersion = current.revision.version; }
    throw error;
  }
  const promoted = await db.transaction(async (tx) => {
    const context = operation.tenantId && operation.participantId
      ? (await tx.select({ participant: signatureParticipants, process: signatureProcesses, contract: followupContracts, followup: followups }).from(signatureParticipants).innerJoin(signatureProcesses, and(eq(signatureProcesses.tenantId, signatureParticipants.tenantId), eq(signatureProcesses.id, signatureParticipants.processId))).innerJoin(followupContracts, and(eq(followupContracts.tenantId, signatureProcesses.tenantId), eq(followupContracts.id, signatureProcesses.followupContractId))).innerJoin(followups, and(eq(followups.tenantId, followupContracts.tenantId), eq(followups.id, followupContracts.followupId))).where(and(eq(signatureParticipants.tenantId, operation.tenantId), eq(signatureParticipants.id, operation.participantId))))[0]
      : null;
    if (!context?.participant || !context?.process || !context?.contract || !context?.followup) throw invalid('Contrato aplicado não encontrado.', 404);
    await tx.execute(sql`select id from applied_documents where tenant_id = ${operation.tenantId} and id = (select id from applied_documents where tenant_id = ${operation.tenantId} and followup_contract_id = ${context.contract.id}) for update`);
    const document = await currentDocument(tx, operation.tenantId, context.contract.id);
    await verifyObjectBytes(operation.candidateObjectKey, operation.candidateHash, operation.candidateSize);
    if (document.revision.id !== operation.baseRevisionId) {
      await tx.update(signatureOperations).set({ status: 'stale', staleReason: 'STALE_DOCUMENT_REVISION' }).where(and(eq(signatureOperations.id, operation.id), eq(signatureOperations.status, 'prepared')));
      await tx.insert(signatureEvents).values({ tenantId: operation.tenantId, participantId: operation.participantId, type: 'stale', metadata: { operationId: operation.id, reason: 'STALE_DOCUMENT_REVISION', currentRevisionId: document.revision.id, currentVersion: document.revision.version } });
      return { stale: true as const, currentRevisionId: document.revision.id, currentVersion: document.revision.version };
    }
    if (context.participant.status !== 'pending' || context.process.status !== 'pending' || terminalFollowup(context.followup.status)) {
      await tx.update(signatureOperations).set({ status: 'rejected', staleReason: 'SIGNATURE_PROCESS_NOT_ACTIVE' }).where(and(eq(signatureOperations.id, operation.id), eq(signatureOperations.status, 'prepared')));
      await tx.insert(signatureEvents).values({ tenantId: operation.tenantId, participantId: operation.participantId, type: 'rejected', metadata: { operationId: operation.id, reason: 'SIGNATURE_PROCESS_NOT_ACTIVE' } });
      throw invalid('O processo de assinatura não está mais disponível.', 409);
    }
    const receipt = (await tx.select().from(signatureExternalReceipts).where(and(eq(signatureExternalReceipts.tenantId, operation.tenantId), eq(signatureExternalReceipts.contentHash, operation.candidateHash))))[0];
    if (!receipt || receipt.validationStatus !== 'validated') throw invalid('O retorno externo não está validado para promoção.', 409);
    try {
      await revalidateExternalAncestors(tx, operation.tenantId, document.document.id, document.revision);
    } catch (error) {
      await tx.update(signatureOperations).set({ status: 'rejected', staleReason: 'EXTERNAL_REVALIDATION_FAILED' }).where(and(eq(signatureOperations.id, operation.id), eq(signatureOperations.status, 'prepared')));
      await tx.insert(signatureEvents).values({ tenantId: operation.tenantId, participantId: operation.participantId, type: 'revalidation_failed', metadata: { operationId: operation.id, reason: (error as Error & { code?: string }).code ?? 'EXTERNAL_REVALIDATION_FAILED' } });
      throw error;
    }
    const candidateRevisionId = randomUUID();
    const revisionRows = (await tx.insert(appliedDocumentRevisions).values({ id: candidateRevisionId, tenantId: operation.tenantId, documentId: document.document.id, version: document.revision.version + 1, parentRevisionId: document.revision.id, objectKey: operation.candidateObjectKey, contentHash: operation.candidateHash, contentSize: operation.candidateSize, origin: 'govbr_external', sourceExternalReceiptId: receipt.id }).returning() as any[]);
    const revision = revisionRows[0];
    if (!revision) throw invalid('Não foi possível registrar a revisão do documento.', 503);
    const updatedRows = (await tx.update(appliedDocuments).set({ currentRevisionId: revision.id }).where(and(eq(appliedDocuments.tenantId, operation.tenantId), eq(appliedDocuments.id, document.document.id), eq(appliedDocuments.currentRevisionId, document.revision.id))).returning() as any[]);
    if (!updatedRows[0]) throw invalid('STALE_DOCUMENT_REVISION', 409);
    const evidence = encryptValue(JSON.stringify({ method: 'govbr_external', acceptanceText: operation.acceptanceText, candidateHash: operation.candidateHash, baseRevisionId: operation.baseRevisionId, attemptId: receipt.attemptId, receiptId: receipt.id, certificateFingerprint: receipt.certificateFingerprint }), evidenceAad(operation.tenantId, operation.participantId));
    const signatureRevisionRows = (await tx.insert(signatureRevisions).values({ tenantId: operation.tenantId, participantId: operation.participantId, revision: context.participant.latestRevision + 1, evidenceCiphertext: evidence.ciphertext, evidenceNonce: evidence.nonce, evidenceKeyVersion: evidence.keyVersion, operationId: operation.id, documentRevisionId: revision.id, method: 'govbr_external', placement: null, signatureImageHash: null, externalReceiptId: receipt.id }).returning() as any[]);
    const acceptEv = normalizeEvidence(operation.fingerprint);
    await tx.insert(signatureEvidence).values({
      tenantId: operation.tenantId, participantId: operation.participantId, documentId: document.document.id,
      documentRevisionId: revision.id, operationId: operation.id, externalAttemptId: receipt.attemptId,
      eventType: context.participant.role === 'professional' ? 'external_accept_representative' : 'external_accept',
      collectorVersion: operation.fingerprintCollectorVersion, normalizationVersion: operation.fingerprintNormalizationVersion,
      attributes: acceptEv.attributes,
      unavailableAttributes: acceptEv.unavailableAttributes,
      normalizedRepresentation: acceptEv.normalizedRepresentation,
      digest: operation.fingerprintDigest, observedIp: operation.observedIp, observedAt: operation.evidenceReceivedAt ?? new Date(),
    });
    const signatureRevision = signatureRevisionRows[0];
    if (!signatureRevision) throw invalid('Não foi possível registrar a assinatura.', 503);
    await tx.insert(signatureEvents).values({ tenantId: operation.tenantId, participantId: operation.participantId, revisionId: signatureRevision.id, type: 'signed', metadata: { operationId: operation.id, documentRevisionId: revision.id, method: 'govbr_external', receiptId: receipt.id } });
    const signedAt = new Date();
    await tx.update(signatureParticipants).set({ status: 'signed', signedAt, latestRevision: signatureRevision.revision, updatedAt: signedAt, identitySnapshot: context.participant.identitySnapshot }).where(and(eq(signatureParticipants.tenantId, operation.tenantId), eq(signatureParticipants.id, operation.participantId), eq(signatureParticipants.status, 'pending')));
    const tokenRow = (await tx.select().from(signatureTokens).where(and(eq(signatureTokens.tenantId, operation.tenantId), eq(signatureTokens.participantId, operation.participantId), isNull(signatureTokens.revokedAt)))).sort((a: any, b: any) => Number(b.createdAt) - Number(a.createdAt))[0];
    if (tokenRow) await tx.update(signatureTokens).set({ revokedAt: signedAt }).where(and(eq(signatureTokens.tenantId, operation.tenantId), eq(signatureTokens.id, tokenRow.id)));
    await tx.update(signatureExternalAttempts).set({ lifecycleStatus: 'completed', completedAt: signedAt }).where(and(eq(signatureExternalAttempts.tenantId, operation.tenantId), eq(signatureExternalAttempts.id, receipt.attemptId)));
    await tx.update(signatureExternalReceipts).set({ promotedRevisionId: revision.id }).where(and(eq(signatureExternalReceipts.tenantId, operation.tenantId), eq(signatureExternalReceipts.id, receipt.id)));
    await tx.update(signatureOperations).set({ status: 'confirmed', confirmedAt: signedAt }).where(and(eq(signatureOperations.tenantId, operation.tenantId), eq(signatureOperations.id, operation.id), eq(signatureOperations.status, 'prepared')));
    return { result: await signatureResult(tx, operation.tenantId, context.participant.processId) };
  });
  if ('stale' in promoted) {
    const error = invalid('STALE_DOCUMENT_REVISION', 409) as Error & { currentRevisionId?: string; currentVersion?: number; code?: string };
    error.code = 'STALE_DOCUMENT_REVISION'; error.currentRevisionId = promoted.currentRevisionId; error.currentVersion = promoted.currentVersion;
    throw error;
  }
  return promoted.result;
}

export async function cancelExternalAttempt(access: string, attemptId: unknown, actor?: ClinicSignatureActor) {
  if (typeof attemptId !== 'string' || !uuid.test(attemptId)) throw invalid('Tentativa inválida.');
  if (access.startsWith('participant:') && !actor) throw invalid('Autenticação necessária.', 401);
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const found = await externalAccessContext(tx, access, actor);
    const attempt = (await tx.select().from(signatureExternalAttempts).where(and(eq(signatureExternalAttempts.tenantId, found.participant.tenantId), eq(signatureExternalAttempts.id, attemptId), eq(signatureExternalAttempts.participantId, found.participant.id))))[0];
    if (!attempt) throw invalid('Tentativa externa não encontrada.', 404);
    if (attempt.lifecycleStatus === 'completed') throw invalid('A tentativa externa já foi concluída.', 409);
    if (attempt.lifecycleStatus === 'cancelled') return { cancelled: true, attemptId: attempt.id };
    await tx.update(signatureExternalAttempts).set({ lifecycleStatus: 'cancelled', cancelledAt: new Date() }).where(and(eq(signatureExternalAttempts.tenantId, found.participant.tenantId), eq(signatureExternalAttempts.id, attempt.id)));
    await tx.insert(signatureEvents).values({ tenantId: found.participant.tenantId, participantId: found.participant.id, type: 'external_cancelled', metadata: { attemptId: attempt.id } });
    return { cancelled: true, attemptId: attempt.id };
  });
}

/** Representante: mesma reserva/exportação pela sessão autenticada. */
export async function exportExternalRevisionAsClinicRepresentative(participantId: string, input: unknown, actor: ClinicSignatureActor, reqContext?: { ip?: string }) {
  return exportExternalRevision(`participant:${participantId}`, input, actor, reqContext);
}
export async function downloadExternalExportAsClinicRepresentative(participantId: string, attemptId: string, actor: ClinicSignatureActor) {
  return downloadExternalExport(`participant:${participantId}`, attemptId, actor);
}
export async function importExternalReturnAsClinicRepresentative(participantId: string, input: unknown, actor: ClinicSignatureActor, reqContext?: { ip?: string }) {
  return importExternalReturn(`participant:${participantId}`, input, actor, reqContext);
}
export async function confirmExternalReturnAsClinicRepresentative(participantId: string, input: unknown, actor: ClinicSignatureActor, reqContext?: { ip?: string }) {
  return confirmExternalReturn(`participant:${participantId}`, input, actor, reqContext);
}
export async function cancelExternalAttemptAsClinicRepresentative(participantId: string, attemptId: unknown, actor: ClinicSignatureActor) {
  return cancelExternalAttempt(`participant:${participantId}`, attemptId, actor);
}

/* ------------------------------------------------------------------ */
/* Histórico e estados do contrato assinado — Issue #28                */
/*                                                                     */
/* Visão legível por contrato aplicado: processo, participantes,       */
/* revisões do documento, tentativas, recebimentos externos e eventos, */
/* com actor/papel/método/revisão/resultado/horário por evento. A via  */
/* pública mascara a identidade do outro participante (LGPD); o painel */
/* autenticado recebe snapshots completos. Nenhum texto apresenta o    */
/* resultado como certificado ICP-Brasil ou aprovação jurídica.        */
/* ------------------------------------------------------------------ */

export const signatureMethodPt: Record<string, string> = {
  local_handwritten: 'Manuscrita local',
  govbr_external: 'Externa GOV.BR',
};

const signatureOriginPt: Record<string, string> = {
  initial: 'Original',
  local_handwritten: 'Manuscrita local',
  govbr_external: 'Externa GOV.BR',
};

const signatureStatusPt: Record<string, string> = {
  pending: 'Pendente',
  signed: 'Assinada',
  revoked: 'Revogada',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  prepared: 'Preparada',
  confirmed: 'Confirmada',
  stale: 'Desatualizada',
  rejected: 'Recusada',
  reserved: 'Reservada',
  return_received: 'Retorno recebido',
  expired: 'Expirada',
};

const signatureEventPt: Record<string, string> = {
  signed: 'Assinatura confirmada',
  stale: 'Tentativa desatualizada',
  rejected: 'Tentativa recusada',
  completed: 'Processo concluído',
  cancelled: 'Assinatura cancelada',
  external_cancelled: 'Tentativa externa cancelada',
  revalidation_failed: 'Revalidação de assinatura externa falhou',
};

const rolePt: Record<string, string> = { patient: 'Paciente', professional: 'Representante da clínica', clinic: 'Clínica' };

type HistoryViewer = { kind: 'panel' } | { kind: 'public'; participantId: string };

function maskSnapshot(role: string, snapshot: any, visible: boolean) {
  if (visible) return snapshot ?? null;
  if (role === 'patient') return { role: 'patient' };
  return { role: 'professional', assignment: 'clinic_representative' };
}

function displayName(role: string, snapshot: any, visible: boolean) {
  if (!visible) return rolePt[role] ?? role;
  if (!snapshot || typeof snapshot !== 'object') return rolePt[role] ?? role;
  if (typeof (snapshot as any).fullName === 'string') return (snapshot as any).fullName;
  if (typeof (snapshot as any).name === 'string') return (snapshot as any).name;
  return rolePt[role] ?? role;
}

export async function getSignatureHistory(tenantId: string, followupContractId: string, viewer: HistoryViewer) {
  if (!uuid.test(followupContractId)) throw invalid('Contrato aplicado inválido.');
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const contract = (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, followupContractId))))[0];
    if (!contract) throw invalid('Contrato aplicado não encontrado.', 404);
    const process = (await tx.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.followupContractId, followupContractId))))[0];
    // Contratos DOCX passam por materialização assíncrona ('generating'/'failed') antes
    // da criação do processo de assinatura. Sem processo ainda não há 404: o painel
    // recebe um histórico pendente com aviso, no mesmo formato do histórico completo.
    if (!process) {
      const pendingStatusLabel: Record<string, string> = { generating: 'Gerando documento', ready: 'Pronto para assinatura', failed: 'Falha na geração' };
      return {
        process: { id: contract.id, status: contract.status, statusLabel: pendingStatusLabel[contract.status] ?? signatureStatusPt[contract.status] ?? contract.status, followupContractId: contract.id },
        contract: {
          id: contract.id, title: contract.titleSnapshot, version: contract.contractVersion, required: contract.required,
          status: contract.status, patientSignedAt: contract.patientSignedAt ?? null, professionalSignedAt: contract.professionalSignedAt ?? null,
        },
        document: null,
        participants: [],
        operations: [],
        externalAttempts: [],
        events: [],
        notice: 'O documento do contrato ainda está sendo gerado a partir do modelo. O histórico de assinaturas ficará disponível assim que a materialização concluir.',
      };
    }
    if (viewer.kind === 'public') {
      const own = (await tx.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.id, (viewer as { participantId: string }).participantId, ), eq(signatureParticipants.processId, process.id))))[0];
      if (!own) throw invalid('Link inválido, expirado ou revogado.', 404);
    }
    const participants = await tx.select().from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.processId, process.id)));
    const document = (await tx.select().from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.followupContractId, followupContractId))))[0];
    const revisions = document
      ? (await tx.select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, document.id)))).sort((a: any, b: any) => a.version - b.version)
      : [];
    const participantIds = participants.map((p: any) => p.id);
    const operations = participantIds.length
      ? await tx.select().from(signatureOperations).where(and(eq(signatureOperations.tenantId, tenantId), sql`${signatureOperations.participantId} in (${sql.join(participantIds.map((id: string) => sql`${id}`), sql`, `)})`))
      : [];
    const sigRevisions = participantIds.length
      ? await tx.select().from(signatureRevisions).where(and(eq(signatureRevisions.tenantId, tenantId), sql`${signatureRevisions.participantId} in (${sql.join(participantIds.map((id: string) => sql`${id}`), sql`, `)})`))
      : [];
    const attempts = participantIds.length
      ? await tx.select().from(signatureExternalAttempts).where(and(eq(signatureExternalAttempts.tenantId, tenantId), sql`${signatureExternalAttempts.participantId} in (${sql.join(participantIds.map((id: string) => sql`${id}`), sql`, `)})`))
      : [];
    const receipts = attempts.length
      ? await tx.select().from(signatureExternalReceipts).where(and(eq(signatureExternalReceipts.tenantId, tenantId), sql`${signatureExternalReceipts.attemptId} in (${sql.join(attempts.map((a: any) => a.id), sql`, `)})`))
      : [];
    const events = participantIds.length
      ? (await tx.select().from(signatureEvents).where(and(eq(signatureEvents.tenantId, tenantId), sql`${signatureEvents.participantId} in (${sql.join(participantIds.map((id: string) => sql`${id}`), sql`, `)})`))).sort((a: any, b: any) => Number(a.occurredAt) - Number(b.occurredAt))
      : [];
    const participantById = new Map(participants.map((p: any) => [p.id, p]));
    const operationById = new Map(operations.map((o: any) => [o.id, o]));
    const revisionById = new Map(revisions.map((r: any) => [r.id, r]));

    const actorOf = (participantId: string, event?: any) => {
      const declared = (event?.metadata ?? {}) as { actor?: { role?: string; name?: string } };
      if (declared.actor?.role) {
        const role = declared.actor.role;
        return { role, name: declared.actor.name ?? rolePt[role] ?? role };
      }
      const participant = participantById.get(participantId) as any;
      if (!participant) return { role: 'unknown', name: 'Desconhecido' };
      const visible = viewer.kind === 'panel' || (viewer.kind === 'public' && (viewer as { participantId: string }).participantId === participantId);
      const latestOperation = operations.filter((o: any) => o.participantId === participantId).sort((a: any, b: any) => Number(b.createdAt) - Number(a.createdAt))[0] as any;
      const snapshot = latestOperation?.identitySnapshot ?? participant.identitySnapshot;
      return { role: participant.role, name: displayName(participant.role, snapshot, visible) };
    };

    const methodOf = (event: any): string | null => {
      const metadata = (event.metadata ?? {}) as any;
      if (typeof metadata.method === 'string') return signatureMethodPt[metadata.method] ?? metadata.method;
      if (metadata.operationId && operationById.get(metadata.operationId)) {
        const method = (operationById.get(metadata.operationId) as any).method;
        return signatureMethodPt[method] ?? method;
      }
      if (metadata.receiptId) {
        const receipt = receipts.find((r: any) => r.id === metadata.receiptId);
        if (receipt) return signatureMethodPt.govbr_external;
      }
      return null;
    };

    const revisionOf = (event: any): string | null => {
      const metadata = (event.metadata ?? {}) as any;
      if (metadata.documentRevisionId && revisionById.get(metadata.documentRevisionId)) {
        return `revisão ${(revisionById.get(metadata.documentRevisionId) as any).version}`;
      }
      if (event.revisionId) {
        const sigRevision = sigRevisions.find((r: any) => r.id === event.revisionId) as any;
        if (sigRevision?.documentRevisionId && revisionById.get(sigRevision.documentRevisionId)) {
          return `revisão ${(revisionById.get(sigRevision.documentRevisionId) as any).version}`;
        }
      }
      if (metadata.currentVersion !== undefined) return `revisão ${metadata.currentVersion}`;
      return null;
    };

    const downloadUrlFor = (revisionId: string) => viewer.kind === 'panel'
      ? `/api/signature-participants/${(participants.find((p: any) => p.role === 'professional') ?? participants[0])?.id}/revisions/${revisionId}/pdf`
      : null;

    return {
      process: { id: process.id, status: process.status, statusLabel: signatureStatusPt[process.status] ?? process.status, followupContractId: process.followupContractId },
      contract: {
        id: contract.id, title: contract.titleSnapshot, version: contract.contractVersion, required: contract.required,
        status: contract.status, patientSignedAt: contract.patientSignedAt ?? null, professionalSignedAt: contract.professionalSignedAt ?? null,
      },
      document: document ? {
        id: document.id, currentRevisionId: document.currentRevisionId,
        hasExternalSignatures: revisions.some((r: any) => r.origin === 'govbr_external'),
        revisions: revisions.map((r: any) => {
          const promotedBy = sigRevisions.find((s: any) => s.documentRevisionId === r.id) as any;
          const promoter = promotedBy ? participantById.get(promotedBy.participantId) as any : null;
          return {
            id: r.id, version: r.version, origin: r.origin, originLabel: signatureOriginPt[r.origin] ?? r.origin,
            hash: r.contentHash, size: r.contentSize, parentRevisionId: r.parentRevisionId,
            createdAt: r.createdAt, promotedBy: promoter ? { role: promoter.role, method: promotedBy.method, methodLabel: signatureMethodPt[promotedBy.method] ?? promotedBy.method } : null,
            downloadUrl: downloadUrlFor(r.id),
          };
        }),
      } : null,
      participants: participants.map((p: any) => {
        const visible = viewer.kind === 'panel' || (viewer.kind === 'public' && (viewer as { participantId: string }).participantId === p.id);
        const methods = [...new Set(sigRevisions.filter((s: any) => s.participantId === p.id).map((s: any) => s.method).filter(Boolean))];
        return {
          id: p.id, role: p.role, roleLabel: rolePt[p.role] ?? p.role,
          status: p.status, statusLabel: signatureStatusPt[p.status] ?? p.status,
          signedAt: p.signedAt ?? null, identity: maskSnapshot(p.role, p.identitySnapshot, visible),
          methods: methods.map((m) => ({ method: m, label: signatureMethodPt[m as string] ?? m })),
        };
      }),
      operations: operations.map((o: any) => ({
        id: o.id, participantId: o.participantId, method: o.method, methodLabel: signatureMethodPt[o.method] ?? o.method,
        status: o.status, statusLabel: signatureStatusPt[o.status] ?? o.status,
        createdAt: o.createdAt, confirmedAt: o.confirmedAt ?? null,
        baseRevisionId: o.baseRevisionId, candidateHash: o.candidateHash,
        staleReason: o.staleReason ?? null, acceptanceText: o.acceptanceText,
      })),
      externalAttempts: attempts.map((a: any) => {
        const receipt = receipts.find((r: any) => r.attemptId === a.id) as any;
        return {
          id: a.id, participantId: a.participantId, provider: a.provider,
          lifecycleStatus: a.lifecycleStatus, lifecycleLabel: signatureStatusPt[a.lifecycleStatus] ?? a.lifecycleStatus,
          validationStatus: a.validationStatus ?? null, validationLabel: a.validationStatus ? (externalValidationPt[a.validationStatus] ?? a.validationStatus) : null,
          exportHash: a.exportHash, exportedAt: a.exportedAt, expiresAt: a.exportExpiresAt,
          importHash: a.importHash ?? null, importedAt: a.importedAt ?? null,
          completedAt: a.completedAt ?? null, cancelledAt: a.cancelledAt ?? null,
          receipt: receipt ? {
            id: receipt.id, validationStatus: receipt.validationStatus,
            validationLabel: externalValidationPt[receipt.validationStatus] ?? receipt.validationStatus,
            reason: (receipt.validationReport as any)?.reason ?? receipt.rejectedReason ?? null,
            signerCommonName: (receipt.signerIdentity as any)?.commonName ?? null,
            certificateFingerprint: receipt.certificateFingerprint ?? null,
            receivedAt: receipt.receivedAt, promotedRevisionId: receipt.promotedRevisionId ?? null,
          } : null,
        };
      }),
      events: events.map((e: any) => ({
        id: e.id, type: e.type, label: signatureEventPt[e.type] ?? e.type,
        occurredAt: e.occurredAt, participantId: e.participantId,
        actor: actorOf(e.participantId, e), method: methodOf(e), revision: revisionOf(e),
      })),
      notice: 'Assinatura eletrônica simples para o fluxo do acompanhamento. Este histórico não constitui certificado ICP-Brasil, reconhecimento de firma nem aprovação jurídica.',
    };
  });
}

export async function readSignatureHistoryByToken(token: string) {
  const found = await getDatabase().transaction(async (tx) => {
    const context = await lockedTokenReadContext(tx, token);
    if (context.participant.role === 'patient' && !context.token.phoneVerifiedAt) throw invalid('Os quatro últimos dígitos do telefone devem ser confirmados antes de visualizar o histórico.', 403);
    if (context.participant.role === 'professional') throw invalid('O representante deve acessar pelo painel autenticado da clínica.', 403);
    return { tenantId: context.participant.tenantId, contractId: context.contract.id, participantId: context.participant.id };
  });
  const history = await getSignatureHistory(found.tenantId, found.contractId, { kind: 'public', participantId: found.participantId }) as any;
  const withUrls = (history.document?.revisions ?? []).map((r: any) => ({ ...r, downloadUrl: `/public/signatures/${token}/revisions/${r.id}/pdf` }));
  return { ...history, document: history.document ? { ...history.document, revisions: withUrls } : history.document };
}

export async function readSignatureRevisionPdf(access: string, revisionId: string, actor?: ClinicSignatureActor) {
  if (!uuid.test(revisionId)) throw invalid('Revisão inválida.');
  if (access.startsWith('participant:') && !actor) throw invalid('Autenticação necessária.', 401);
  const found = await getDatabase().transaction(async (tx) => {
    const context = access.startsWith('participant:')
      ? await lockedParticipantReadContext(tx, access.slice('participant:'.length), actor!)
      : await lockedTokenReadContext(tx, access);
    if (context.participant.role === 'patient' && !(context as { token?: any }).token?.phoneVerifiedAt) throw invalid('Os quatro últimos dígitos do telefone devem ser confirmados antes de visualizar o PDF.', 403);
    if (context.participant.role === 'professional' && access.startsWith('participant:') === false) throw invalid('O representante deve acessar pelo painel autenticado da clínica.', 403);
    const revision = (await tx.select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, context.participant.tenantId), eq(appliedDocumentRevisions.id, revisionId))))[0];
    if (!revision) throw invalid('Revisão não encontrada.', 404);
    const document = await currentDocument(tx, context.participant.tenantId, context.contract.id);
    if (revision.documentId !== document.document.id) throw invalid('Revisão não encontrada.', 404);
    return { key: revision.objectKey, hash: revision.contentHash, size: revision.contentSize };
  });
  return readDocumentBytes({ key: found.key, hash: found.hash, size: found.size });
}
