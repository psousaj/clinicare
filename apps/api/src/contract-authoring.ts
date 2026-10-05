import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { contracts, contractVersions, getDatabase } from '@clinicare/db';
import {
  DOCX_CONTENT_TYPE,
  PLACEHOLDERS,
  inspectDocxPlaceholders,
  validatePlaceholderConfiguration,
  validateDocxPlaceholders,
} from './contract-materialization';
import { copyVerifiedObject, downloadObjectBytes, downloadUrl, uploadUrlForDocument, verifyObject } from './storage';

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

export async function publishContractDraft(tenantId: string, contractId: string) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
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
    return created;
  });
}

export async function listContractPlaceholders() {
  return [...PLACEHOLDERS];
}
