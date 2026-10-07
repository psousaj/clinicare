import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { buildProtectedAad, contracts, contractVersions, encryptValue, followupContracts, followups, getDatabase, signatureEvents, signatureParticipants, signatureProcesses } from '@clinicare/db';
import {
  DOCX_CONTENT_TYPE,
  PLACEHOLDERS,
  inspectDocxPlaceholders,
  validatePlaceholderConfiguration,
  validateDocxPlaceholders,
} from './contract-materialization';
import { copyVerifiedObject, downloadObjectBytes, downloadUrl, uploadUrlForDocument, verifyObject } from './storage';
import { generateFollowupContract, replaceUnsignedAppliedContract } from './contract-generation';

const invalid = (message: string, status = 400) => Object.assign(new Error(message), { status });
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function docxMetadata(input: any) {
  if (input?.contentType !== DOCX_CONTENT_TYPE || !/^[0-9a-f]{64}$/i.test(input?.contentHash ?? '') || !Number.isSafeInteger(input?.size) || input.size <= 0) {
    throw invalid('O draft deve usar um DOCX válido com hash e tamanho declarados.');
  }
  return { contentType: DOCX_CONTENT_TYPE, contentHash: String(input.contentHash).toLowerCase(), size: input.size as number };
}

export async function presignContractDraft(tenantId: string, contractId: string) {
  const contract = (await getDatabase().select({ id: contracts.id }).from(contracts).where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId))))[0];
  if (!contract) return null;
  const objectKey = randomUUID();
  return { objectKey, uploadUrl: await uploadUrlForDocument(objectKey), contentType: DOCX_CONTENT_TYPE, expiresInSeconds: 300 };
}

export async function getContractDraftEditor(tenantId: string, contractId: string) {
  const contract = (await getDatabase().select().from(contracts).where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId))))[0];
  if (!contract) return null;
  if (!contract.draftDocxObjectKey) throw invalid('O contrato não possui um draft DOCX.');
  const url = await downloadUrl(contract.draftDocxObjectKey);
  if (!url) throw new Error('R2 is not configured.');
  return { documentKey: contract.draftDocxObjectKey, documentUrl: url, title: contract.title };
}

export async function saveContractDraft(tenantId: string, contractId: string, input: any) {
  const metadata = docxMetadata(input);
  const contexts = validatePlaceholderConfiguration(input.contexts, input.allowedPlaceholders, input.requiredPlaceholders);
  const contract = (await getDatabase().select().from(contracts).where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId))))[0];
  if (!contract) return null;
  if (!uuid(input.objectKey)) throw invalid('Objeto DOCX inválido.');
  if (!await verifyObject(input.objectKey, metadata.contentHash, metadata.size, DOCX_CONTENT_TYPE)) throw invalid('O DOCX enviado não corresponde aos metadados declarados.');
  const bytes = await downloadObjectBytes(input.objectKey);
  validateDocxPlaceholders(bytes, contexts.contexts, contexts.allowedPlaceholders, contexts.requiredPlaceholders);
  await getDatabase().update(contracts).set({
    draftDocxObjectKey: input.objectKey,
    draftDocxHash: metadata.contentHash,
    draftDocxSize: metadata.size,
    draftDocxContentType: metadata.contentType,
    draftContextConfiguration: contexts.contexts,
    draftAllowedPlaceholders: contexts.allowedPlaceholders,
    draftRequiredPlaceholders: contexts.requiredPlaceholders,
    updatedAt: new Date(),
  }).where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId)));
  return { contractId, objectKey: input.objectKey, hash: metadata.contentHash, size: metadata.size, discoveredPlaceholders: inspectDocxPlaceholders(bytes) };
}

// Publicar propaga a nova versão aos contratos aplicados ainda sem nenhuma
// assinatura: sem R0, atualiza a versão na linha; com R0 (ready/pending),
// cancela a linha antiga (R0 preservado como histórico) e cria uma linha
// substituta em geração. Com assinatura, o documento permanece congelado.
export async function propagatePublishedVersion(tx: any, tenantId: string, contractId: string, version: any, title: string) {
  if (!version?.sourceDocxObjectKey) return;
  const stale: any[] = await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.contractId, contractId), sql`${followupContracts.contractVersion} < ${version.version}`, sql`${followupContracts.status} in ('generating','failed','ready','pending')`, sql`${followupContracts.patientSignedAt} is null`, sql`${followupContracts.professionalSignedAt} is null`));
  if (!stale.length) return;
  const followupIds: string[] = [...new Set<string>(stale.map((row: any) => String(row.followupId)))];
  const liveFollowups: any[] = followupIds.length ? await tx.select({ id: followups.id }).from(followups).where(and(eq(followups.tenantId, tenantId), inArray(followups.id, followupIds), sql`${followups.status} not in ('cancelled','completed')`)) : [];
  const live = new Set(liveFollowups.map((row: any) => row.id));
  let candidates: any[] = stale.filter((row: any) => live.has(row.followupId));
  if (!candidates.length) return;
  const processes: any[] = candidates.length ? await tx.select({ id: signatureProcesses.id, contractId: signatureProcesses.followupContractId }).from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), inArray(signatureProcesses.followupContractId, candidates.map((row: any) => row.id)))) : [];
  const processOf = new Map<string, any>(processes.map((item: any) => [String(item.contractId), item] as [string, any]));
  if (processes.length) {
    const signed: any[] = await tx.select({ processId: signatureParticipants.processId }).from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), inArray(signatureParticipants.processId, processes.map((item: any) => item.id)), eq(signatureParticipants.status, 'signed')));
    const signedProcesses = new Set(signed.map((item: any) => item.processId));
    // Qualquer assinatura (mesmo parcial) congela o contrato aplicado.
    candidates = candidates.filter((row: any) => {
      const process = processOf.get(String(row.id));
      return !process || !signedProcesses.has(process.id);
    });
    if (!candidates.length) return;
  }
  for (const row of candidates.filter((row: any) => !row.renderedPdfObjectKey && (row.status === 'generating' || row.status === 'failed') && !row.materializedDocxObjectKey && !processOf.has(String(row.id)))) {
    const protectedContent = version.content == null
      ? { contentCiphertext: null, contentNonce: null, contentKeyVersion: null }
      : (() => { const encrypted = encryptValue(version.content, buildProtectedAad(tenantId, 'followup_contracts', row.id, 'content')); return { contentCiphertext: encrypted.ciphertext, contentNonce: encrypted.nonce, contentKeyVersion: encrypted.keyVersion }; })();
    await tx.update(followupContracts).set({
      contractVersion: version.version, titleSnapshot: title, ...protectedContent,
      sourceObjectKey: version.sourceObjectKey ?? null,
      materializationContextCiphertext: null, materializationContextNonce: null, materializationContextKeyVersion: null, materializationContextDigest: null,
      materializedDocxObjectKey: null, materializedDocxHash: null, materializedDocxSize: null,
      status: 'generating', generationError: null,
    }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, row.id), sql`${followupContracts.renderedPdfObjectKey} is null`));
  }
  for (const row of candidates.filter((row: any) => row.renderedPdfObjectKey && (row.status === 'ready' || row.status === 'pending'))) {
    await replaceUnsignedAppliedContract(tx, tenantId, row, version, title);
  }
}

export async function publishContractDraft(tenantId: string, contractId: string, professionalUserId?: string) {
  const db = getDatabase();
  let isNew = false;
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from contracts where tenant_id = ${tenantId} and id = ${contractId} for update`);
    const contract = (await tx.select().from(contracts).where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId))))[0];
    if (!contract) return null;
    if (!contract.draftDocxObjectKey || !contract.draftDocxHash || !contract.draftDocxSize || !contract.draftContextConfiguration || !contract.draftAllowedPlaceholders || !contract.draftRequiredPlaceholders) throw invalid('O contrato não possui um draft DOCX publicável.');
    const bytes = await downloadObjectBytes(contract.draftDocxObjectKey);
    if (bytes.byteLength !== contract.draftDocxSize || sha256(bytes) !== contract.draftDocxHash.toLowerCase()) throw invalid('O draft DOCX foi alterado ou não corresponde ao hash salvo.');
    const configuration = validatePlaceholderConfiguration(contract.draftContextConfiguration, contract.draftAllowedPlaceholders, contract.draftRequiredPlaceholders);
    validateDocxPlaceholders(bytes, configuration.contexts, configuration.allowedPlaceholders, configuration.requiredPlaceholders);
    const current = contract.currentVersion > 0 ? (await tx.select().from(contractVersions).where(and(eq(contractVersions.tenantId, tenantId), eq(contractVersions.contractId, contractId), eq(contractVersions.version, contract.currentVersion))))[0] : null;
    if (current && current.sourceDocxHash === contract.draftDocxHash && JSON.stringify(current.contextConfiguration) === JSON.stringify(configuration.contexts) && JSON.stringify(current.allowedPlaceholders) === JSON.stringify(configuration.allowedPlaceholders) && JSON.stringify(current.requiredPlaceholders) === JSON.stringify(configuration.requiredPlaceholders)) return current;
    const version = (contract.currentVersion || 0) + 1;
    const immutableKey = randomUUID();
    await copyVerifiedObject(contract.draftDocxObjectKey, immutableKey, contract.draftDocxHash, contract.draftDocxSize, DOCX_CONTENT_TYPE);
    const [created] = await tx.insert(contractVersions).values({
      tenantId, contractId, version, sourceDocxObjectKey: immutableKey, sourceDocxHash: contract.draftDocxHash, sourceDocxSize: contract.draftDocxSize, sourceDocxContentType: DOCX_CONTENT_TYPE,
      contextConfiguration: configuration.contexts, allowedPlaceholders: configuration.allowedPlaceholders, requiredPlaceholders: configuration.requiredPlaceholders,
      origin: 'created', content: null, sourceObjectKey: null,
    }).returning();
    await tx.update(contracts).set({ currentVersion: version, updatedAt: new Date() }).where(and(eq(contracts.tenantId, tenantId), eq(contracts.id, contractId)));
    await propagatePublishedVersion(tx, tenantId, contractId, created, contract.title);
    isNew = true;
    return created;
  });
  if (isNew && professionalUserId) {
    // Sem cron/worker: re-renderiza em background os contratos aplicados que
    // voltaram para geração (mesmo padrão do POST /api/followups).
    const pending = await db.select({ id: followupContracts.id }).from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.contractId, contractId), eq(followupContracts.status, 'generating')));
    if (pending.length) {
      void (async () => {
        for (const row of pending) {
          try { await generateFollowupContract(tenantId, row.id, professionalUserId); }
          catch { /* mantém generating/failed com generationError p/ retry manual */ }
        }
      })().catch(() => undefined);
    }
  }
  return result;
}

export async function listContractPlaceholders() {
  return [...PLACEHOLDERS];
}
