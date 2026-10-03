import { and, desc, eq, sql } from 'drizzle-orm';
import {
  buildProtectedAad, decryptValue, encryptValue, getDatabase, followupContracts, followups, patients,
  signatureEvents, signatureParticipants, signatureProcesses, signatureRevisions, signatureTokens,
} from '@clinicare/db';
import { createHash, randomBytes } from 'node:crypto';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const expiry = () => new Date(Date.now() + 7 * 86400000);
const invalid = (message: string, status = 400) => Object.assign(new Error(message), { status });
const tokenResult = (token: string, expiresAt: Date, participantId: string) => ({ participantId, token, expiresAt, url: `/public/signatures/${token}` });
const contentAad = (tenantId: string, contractId: string, keyVersion?: number) => buildProtectedAad(tenantId, 'followup_contracts', contractId, 'content', keyVersion);
const evidenceAad = (tenantId: string, participantId: string, keyVersion?: number) => buildProtectedAad(tenantId, 'signature_revisions', participantId, 'evidence', keyVersion);
const terminalFollowup = (status: string) => status === 'cancelled' || status === 'completed';

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
    return tokenResult(token, expiresAt, participantId);
  });
}

async function tokenParticipant(executor: any, token: string, includeRevoked = false) {
  const row = (await executor.select({ token: signatureTokens, participant: signatureParticipants }).from(signatureTokens).innerJoin(signatureParticipants, and(eq(signatureParticipants.tenantId, signatureTokens.tenantId), eq(signatureParticipants.id, signatureTokens.participantId))).where(and(eq(signatureTokens.tokenHash, hashToken(token)), ...(includeRevoked ? [] : [sql`${signatureTokens.revokedAt} is null`]), sql`${signatureTokens.expiresAt} > now()`)))[0];
  if (!row) throw invalid('Link inválido, expirado ou revogado.', 404);
  return row;
}

/**
 * The first lookup is only a candidate lookup. The token is locked and looked up
 * again after the followup/process/participant locks so refresh cannot race a
 * signing or read into accepting a token that was just revoked.
 */
async function lockedTokenContext(tx: any, rawToken: string, allowConsumed = false) {
  const candidate = await tokenParticipant(tx, rawToken, true);
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

export async function readSignatureToken(token: string) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const found = await lockedTokenContext(tx, token);
    const { participant, token: tokenRow, contract } = found;
    const content = contract.contentCiphertext ? decryptValue({ ciphertext: contract.contentCiphertext, nonce: contract.contentNonce!, keyVersion: contract.contentKeyVersion! }, contentAad(participant.tenantId, contract.id, contract.contentKeyVersion!)) : null;
    return { participantId: participant.id, role: participant.role, status: participant.status, expiresAt: tokenRow.expiresAt, contract: { id: contract.id, followupId: contract.followupId, title: contract.titleSnapshot, version: contract.contractVersion, content, sourceObjectKey: contract.sourceObjectKey } };
  });
}

export async function refreshSignatureToken(tenantId: string, participantId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(participantId)) throw invalid('Participante inválido.');
  return issueSignatureToken(tenantId, participantId);
}

export async function signWithToken(token: string, evidence: unknown) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    const found = await lockedTokenContext(tx, token, true);
    const { participant } = found;
    if (participant.status === 'signed') return signatureResult(tx, participant.tenantId, participant.processId);

    const revision = participant.latestRevision + 1;
    const evidenceValue = typeof evidence === 'string' ? evidence : JSON.stringify(evidence ?? {});
    const encrypted = encryptValue(evidenceValue, evidenceAad(participant.tenantId, participant.id));
    const [revisionRow] = await tx.insert(signatureRevisions).values({ tenantId: participant.tenantId, participantId: participant.id, revision, evidenceCiphertext: encrypted.ciphertext, evidenceNonce: encrypted.nonce, evidenceKeyVersion: encrypted.keyVersion }).returning();
    await tx.insert(signatureEvents).values({ tenantId: participant.tenantId, participantId: participant.id, revisionId: revisionRow.id, type: 'signed', metadata: { revision, role: participant.role } });
    const signedAt = new Date();
    await tx.update(signatureParticipants).set({ status: 'signed', signedAt, latestRevision: revision, updatedAt: signedAt }).where(and(eq(signatureParticipants.tenantId, participant.tenantId), eq(signatureParticipants.id, participant.id)));
    await tx.update(signatureTokens).set({ revokedAt: signedAt }).where(and(eq(signatureTokens.tenantId, participant.tenantId), eq(signatureTokens.id, found.token.id)));
    return signatureResult(tx, participant.tenantId, participant.processId);
  });
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

export async function listPendingSignatures(tenantId: string) {
  const db = getDatabase();
  const rows = await db.select({ participant: signatureParticipants, process: signatureProcesses, contract: followupContracts, followup: followups, patient: patients }).from(signatureParticipants).innerJoin(signatureProcesses, and(eq(signatureProcesses.tenantId, signatureParticipants.tenantId), eq(signatureProcesses.id, signatureParticipants.processId))).innerJoin(followupContracts, and(eq(followupContracts.tenantId, signatureProcesses.tenantId), eq(followupContracts.id, signatureProcesses.followupContractId))).innerJoin(followups, and(eq(followups.tenantId, followupContracts.tenantId), eq(followups.id, followupContracts.followupId))).innerJoin(patients, and(eq(patients.tenantId, followups.tenantId), eq(patients.id, followups.patientId))).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.status, 'pending'), eq(signatureProcesses.status, 'pending'), sql`${followups.status} not in ('cancelled', 'completed')`)).orderBy(desc(signatureParticipants.createdAt));
  return rows.map((row: any) => ({ participantId: row.participant.id, role: row.participant.role, status: row.participant.status, followupId: row.contract.followupId, contractId: row.contract.id, title: row.contract.titleSnapshot, blocking: row.participant.role === 'patient' && row.contract.required, patient: { id: row.patient.id, fullName: row.patient.fullName } }));
}
