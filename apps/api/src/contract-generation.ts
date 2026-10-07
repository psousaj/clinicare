import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  appliedDocuments, appliedDocumentRevisions, authUsers, buildPatientAad, buildProtectedAad, contractVersions, decryptValue, encryptValue, followupContracts, followupItems, followups,
  getDatabase, patients, professionals, signatureEvents, signatureParticipants, signatureProcesses, signatureTokens,
} from '@clinicare/db';
import { getFollowup } from './followups';
import { decryptMaterializationContext, encryptMaterializationContext, renderDocx, type MaterializationContext } from './contract-materialization';
import { createLibreOfficeConverter } from './docx-pdf';
import { deleteObject, downloadObjectBytes, uploadObjectBytes, verifyObject } from './storage';

const invalid = (message: string, status = 400) => Object.assign(new Error(message), { status });
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF = 'application/pdf';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const formatCivilDate = (value: string | null | undefined) => value && datePattern.test(value) ? value.split('-').reverse().join('/') : null;
const protectedValue = (row: any, tenantId: string, field: 'cpf' | 'phone', patientId: string) => row[`${field}Ciphertext`] ? decryptValue({ ciphertext: row[`${field}Ciphertext`], nonce: row[`${field}Nonce`], keyVersion: row[`${field}KeyVersion`] }, buildPatientAad(tenantId, patientId, field, row[`${field}KeyVersion`])) : null;
const protectedFollowupValue = (tenantId: string, id: string, column: string, value: string | null) => value == null ? { contentCiphertext: null, contentNonce: null, contentKeyVersion: null } : (() => { const encrypted = encryptValue(value, buildProtectedAad(tenantId, 'followup_contracts', id, column)); return { contentCiphertext: encrypted.ciphertext, contentNonce: encrypted.nonce, contentKeyVersion: encrypted.keyVersion }; })();

function contextForVersion(full: MaterializationContext, version: any): MaterializationContext {
  const enabled = version.contextConfiguration ?? {};
  const result: MaterializationContext = {};
  for (const key of ['patient', 'professional', 'clinic', 'application', 'plan'] as const) if (enabled[key]?.enabled) result[key] = full[key];
  return result;
}

// Plano lista cada procedimento. Evento lista a escolha do paciente: procedimento avulso pelo nome e combo escolhido uma única vez pelo nome do pacote.
export function contractedNames(offerType: string, items: Array<{ procedureName: string; comboName?: string | null }>) {
  if (offerType !== 'event') return items.map((item) => item.procedureName);
  return [...new Set(items.map((item) => item.comboName ?? item.procedureName))];
}

async function buildContext(tenantId: string, followupId: string, professionalUserId?: string): Promise<MaterializationContext> {
  const db = getDatabase();
  const followup = (await db.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId))))[0];
  if (!followup) throw invalid('Acompanhamento não encontrado.', 404);
  const patient = (await db.select().from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.id, followup.patientId))))[0];
  if (!patient) throw invalid('Paciente não encontrado.', 404);
  const items = await db.select({ procedureName: followupItems.procedureName, comboName: followupItems.comboName }).from(followupItems).where(and(eq(followupItems.tenantId, tenantId), eq(followupItems.followupId, followupId)));
  if (!professionalUserId) throw invalid('Profissional habilitado é obrigatório para materializar o contrato.');
  const user = (await db.select().from(authUsers).where(and(eq(authUsers.tenantId, tenantId), eq(authUsers.id, professionalUserId))))[0];
  const professional = user ? (await db.select().from(professionals).where(and(eq(professionals.tenantId, tenantId), eq(professionals.userId, user.id), eq(professionals.active, true))))[0] : null;
  if (!user || !professional) throw invalid('Profissional habilitado não encontrado.', 409);
  const tenant = (await db.execute(sql`select id, name from tenants where id = ${tenantId}`)).rows[0] as any;
  const cpf = protectedValue(patient, tenantId, 'cpf', patient.id);
  const phone = protectedValue(patient, tenantId, 'phone', patient.id);
  return {
    patient: { name: patient.fullName, cpf, birthDate: formatCivilDate(patient.birthDate) },
    professional: { name: user.name, registration: `${professional.registrationType} ${professional.registrationNumber}${professional.registrationState ? `/${professional.registrationState}` : ''}` },
    clinic: { name: tenant?.name ?? '' },
    application: { date: formatCivilDate(followup.contractApplicationDate) },
    plan: { procedures: contractedNames(followup.offerType, items).map((name) => `☒ ${name}`) },
  } as MaterializationContext;
}

async function createInitialSignatureProcesses(tenantId: string, followupId: string) {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from followups where tenant_id = ${tenantId} and id = ${followupId} for update`);
    const followup = (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId))))[0];
    if (!followup || followup.status === 'cancelled') return;
    const applied = await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.followupId, followupId)));
    // Linhas canceladas (ex.: R0 substituído por reprocessamento) são histórico
    // e não bloqueiam nem ganham processo de assinatura.
    const signable = applied.filter((contract) => contract.status !== 'cancelled');
    if (!signable.length || signable.some((contract) => !['ready', 'pending', 'signed'].includes(contract.status))) return;
    const existing = await tx.select({ contractId: signatureProcesses.followupContractId }).from(signatureProcesses).innerJoin(followupContracts, eq(signatureProcesses.followupContractId, followupContracts.id)).where(and(eq(signatureProcesses.tenantId, tenantId), eq(followupContracts.followupId, followupId)));
    const withProcess = new Set(existing.map((row) => row.contractId));
    const missing = signable.filter((contract) => !withProcess.has(contract.id));
    if (!missing.length) return;
    const patient = (await tx.select().from(patients).where(and(eq(patients.tenantId, tenantId), eq(patients.id, followup.patientId))))[0];
    const phone = patient ? protectedValue(patient, tenantId, 'phone', patient.id) : null;
    if (!phone) return;
    const processes = await tx.insert(signatureProcesses).values(missing.map((contract) => ({ tenantId, followupContractId: contract.id }))).returning();
    const participants = await tx.insert(signatureParticipants).values(processes.flatMap((process: any) => [
      { id: randomUUID(), tenantId, processId: process.id, role: 'patient', identitySnapshot: { role: 'patient', patientId: patient.id, fullName: patient.fullName, phoneLast4Hash: createHash('sha256').update(phone.slice(-4)).digest('hex') } },
      { id: randomUUID(), tenantId, processId: process.id, role: 'professional', identitySnapshot: { role: 'professional', assignment: 'clinic_representative' } },
    ])).returning();
    for (const participant of participants) {
      const token = randomBytes(32).toString('base64url');
      await tx.insert(signatureTokens).values({ tenantId, participantId: participant.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 7 * 86400000) });
    }
  });
}

export async function generateFollowupContract(tenantId: string, followupContractId: string, professionalUserId?: string) {
  const db = getDatabase();
  const locked = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from followup_contracts where tenant_id = ${tenantId} and id = ${followupContractId} for update`);
    const row = (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, followupContractId))))[0];
    if (!row) throw invalid('Contrato aplicado não encontrado.', 404);
    if (row.status === 'cancelled' || row.status === 'signed' || (row.status === 'ready' && row.renderedPdfObjectKey)) return { row, skip: true };
    const followup = (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, row.followupId))))[0];
    if (!followup || followup.status === 'cancelled') return { row, skip: true };
    await tx.update(followupContracts).set({ status: 'generating', generationError: null }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, followupContractId)));
    return { row, skip: false };
  });
  if (locked.skip) return locked.row;
  let context: MaterializationContext;
  const generatedObjectKeys: string[] = [];
  try {
    const version = (await db.select().from(contractVersions).where(and(eq(contractVersions.tenantId, tenantId), eq(contractVersions.contractId, locked.row.contractId), eq(contractVersions.version, locked.row.contractVersion))))[0];
    if (!version?.sourceDocxObjectKey) throw invalid('A versão publicada não possui fonte DOCX.');
    const hasEncryptedContext = Boolean(locked.row.materializationContextCiphertext || locked.row.materializationContextNonce || locked.row.materializationContextKeyVersion);
    if (hasEncryptedContext && (!locked.row.materializationContextCiphertext || !locked.row.materializationContextNonce || !locked.row.materializationContextKeyVersion)) throw invalid('Snapshot de contexto inconsistente.');
    context = locked.row.materializationContextCiphertext ? decryptMaterializationContext(tenantId, locked.row.id, { ciphertext: locked.row.materializationContextCiphertext, nonce: locked.row.materializationContextNonce as string, keyVersion: locked.row.materializationContextKeyVersion as number }) : await buildContext(tenantId, locked.row.followupId, professionalUserId);
    context = contextForVersion(context, version);
    if (!locked.row.materializationContextCiphertext) {
      const encrypted = encryptMaterializationContext(tenantId, locked.row.id, context);
      await db.update(followupContracts).set({ materializationContextCiphertext: encrypted.ciphertext, materializationContextNonce: encrypted.nonce, materializationContextKeyVersion: encrypted.keyVersion, materializationContextDigest: encrypted.digest }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, locked.row.id), isNull(followupContracts.materializedDocxObjectKey)));
    }
    const source = await downloadObjectBytes(version.sourceDocxObjectKey);
    const rendered = renderDocx(source, context, { contexts: version.contextConfiguration, allowedPlaceholders: version.allowedPlaceholders, requiredPlaceholders: version.requiredPlaceholders });
    const docxKey = randomUUID();
    generatedObjectKeys.push(docxKey);
    await uploadObjectBytes(docxKey, rendered, DOCX);
    if (!await verifyObject(docxKey, hash(rendered), rendered.byteLength, DOCX)) throw new Error('Materialized DOCX failed storage verification.');
    const converter = createLibreOfficeConverter();
    const pdf = await converter.convertDocxToPdf(rendered);
    const pdfKey = randomUUID();
    generatedObjectKeys.push(pdfKey);
    await uploadObjectBytes(pdfKey, pdf, PDF);
    if (pdf.byteLength < 5 || new TextDecoder().decode(pdf.slice(0, 5)) !== '%PDF-') throw new Error('LibreOffice returned an invalid PDF.');
    const pdfHash = hash(pdf);
    if (!await verifyObject(pdfKey, pdfHash, pdf.byteLength, PDF)) throw new Error('R0 PDF failed storage verification.');
    const docxHash = hash(rendered);
    await db.transaction(async (tx) => {
      await tx.execute(sql`select id from followup_contracts where tenant_id = ${tenantId} and id = ${locked.row.id} for update`);
      const current = (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, locked.row.id))))[0];
      const currentFollowup = current ? (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, current.followupId))))[0] : null;
      if (!current || current.status === 'cancelled' || currentFollowup?.status === 'cancelled') return;
      await tx.update(followupContracts).set({ materializedDocxObjectKey: docxKey, materializedDocxHash: docxHash, materializedDocxSize: rendered.byteLength, renderedPdfObjectKey: pdfKey, renderedPdfHash: pdfHash, renderedPdfSize: pdf.byteLength, renderedPdfContentType: PDF, status: 'ready', generationError: null }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, locked.row.id), isNull(followupContracts.renderedPdfObjectKey)));
      await tx.execute(sql`select set_config('app.constructing_applied_document', 'on', true)`);
      const documentId = randomUUID(), revisionId = randomUUID();
      await tx.insert(appliedDocuments).values({ id: documentId, tenantId, followupContractId: locked.row.id, originalObjectKey: pdfKey, originalHash: pdfHash, originalSize: pdf.byteLength });
      await tx.insert(appliedDocumentRevisions).values({ id: revisionId, tenantId, documentId, version: 1, parentRevisionId: null, objectKey: pdfKey, contentHash: pdfHash, contentSize: pdf.byteLength });
      await tx.update(appliedDocuments).set({ currentRevisionId: revisionId }).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId), isNull(appliedDocuments.currentRevisionId)));
    });
    await createInitialSignatureProcesses(tenantId, locked.row.followupId);
    return await getFollowup(tenantId, locked.row.followupId);
  } catch (error) {
    await Promise.all(generatedObjectKeys.map((key) => deleteObject(key).catch(() => undefined)));
    await db.update(followupContracts).set({ status: 'failed', generationError: error instanceof Error ? error.message : String(error) }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, locked.row.id), sql`${followupContracts.status} = 'generating'`));
    throw error;
  }
}

export async function retryFollowupContract(tenantId: string, followupContractId: string, professionalUserId?: string) {
  const row = (await dbRows(tenantId, followupContractId))[0];
  if (!row) return null;
  if (row.status === 'cancelled') throw invalid('Acompanhamento cancelado não pode ser regenerado.', 409);
  return generateFollowupContract(tenantId, followupContractId, professionalUserId);
}

// Substitui um contrato aplicado com R0 ainda sem nenhuma assinatura: cancela
// a linha antiga (R0 preservado como histórico, processo cancelado com evento
// de auditoria) e cria uma substituta em geração na mesma versão. A geração
// reconstrói o contexto do zero, com os dados atuais do paciente.
export async function replaceUnsignedAppliedContract(tx: any, tenantId: string, row: any, version: any, title: string, reason = 'Nova versão publicada; contrato substituído automaticamente.') {
  const processes: any[] = await tx.select({ id: signatureProcesses.id }).from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.followupContractId, row.id)));
  for (const process of processes) {
    await tx.update(signatureProcesses).set({ status: 'cancelled', updatedAt: new Date() }).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, process.id), eq(signatureProcesses.status, 'pending')));
    const parts: any[] = await tx.select({ id: signatureParticipants.id }).from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.processId, process.id)));
    for (const part of parts) {
      await tx.insert(signatureEvents).values({ tenantId, participantId: part.id, type: 'cancelled', metadata: { processId: process.id, followupContractId: row.id, reason, actor: { role: 'clinic' } } });
    }
  }
  await tx.update(followupContracts).set({ status: 'cancelled' }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, row.id), sql`${followupContracts.status} in ('ready','pending')`));
  const replacementId = randomUUID();
  const protectedContent = version.content == null
    ? { contentCiphertext: null, contentNonce: null, contentKeyVersion: null }
    : (() => { const encrypted = encryptValue(version.content, buildProtectedAad(tenantId, 'followup_contracts', replacementId, 'content')); return { contentCiphertext: encrypted.ciphertext, contentNonce: encrypted.nonce, contentKeyVersion: encrypted.keyVersion }; })();
  await tx.insert(followupContracts).values({
    id: replacementId, tenantId, followupId: row.followupId, contractId: row.contractId, contractVersion: version.version,
    titleSnapshot: title, ...protectedContent, sourceObjectKey: version.sourceObjectKey ?? null,
    required: row.required ?? true, status: 'generating', generationError: null,
  });
  return replacementId;
}

// Reprocessamento manual do PDF: volta o contrato sem assinatura para geração
// com o contexto reconstruído dos dados atuais (paciente, profissional,
// clínica) e gera na hora. Com R0, substitui a linha preservando o histórico.
export async function reprocessFollowupContract(tenantId: string, followupContractId: string, professionalUserId?: string) {
  const db = getDatabase();
  const targetId = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from followup_contracts where tenant_id = ${tenantId} and id = ${followupContractId} for update`);
    const row = (await tx.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, followupContractId))))[0];
    if (!row) throw invalid('Contrato aplicado não encontrado.', 404);
    if (row.status === 'signed' || row.patientSignedAt || row.professionalSignedAt) throw invalid('Contrato já possui assinatura e não pode ser reprocessado.', 409);
    if (row.status === 'cancelled') throw invalid('Contrato cancelado não pode ser reprocessado.', 409);
    const followup = (await tx.select().from(followups).where(and(eq(followups.tenantId, tenantId), eq(followups.id, row.followupId))))[0];
    if (!followup || followup.status === 'cancelled' || followup.status === 'completed') throw invalid('Acompanhamento encerrado não pode ter contratos reprocessados.', 409);
    const processes: any[] = await tx.select({ id: signatureProcesses.id }).from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.followupContractId, row.id)));
    if (processes.length) {
      const signed: any[] = await tx.select({ id: signatureParticipants.id }).from(signatureParticipants).where(and(eq(signatureParticipants.tenantId, tenantId), inArray(signatureParticipants.processId, processes.map((process: any) => process.id)), eq(signatureParticipants.status, 'signed')));
      if (signed.length) throw invalid('Contrato já possui assinatura e não pode ser reprocessado.', 409);
    }
    if (row.renderedPdfObjectKey) {
      const version = (await tx.select().from(contractVersions).where(and(eq(contractVersions.tenantId, tenantId), eq(contractVersions.contractId, row.contractId), eq(contractVersions.version, row.contractVersion))))[0];
      if (!version) throw invalid('Versão do contrato não encontrada.', 409);
      return replaceUnsignedAppliedContract(tx, tenantId, row, version, row.titleSnapshot, 'Reprocessamento manual; contrato substituído com os dados atuais.');
    }
    await tx.update(followupContracts).set({
      materializationContextCiphertext: null, materializationContextNonce: null, materializationContextKeyVersion: null, materializationContextDigest: null,
      materializedDocxObjectKey: null, materializedDocxHash: null, materializedDocxSize: null,
      status: 'generating', generationError: null,
    }).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, row.id), sql`${followupContracts.renderedPdfObjectKey} is null`));
    return row.id;
  });
  return generateFollowupContract(tenantId, targetId, professionalUserId);
}
async function dbRows(tenantId: string, id: string) { return getDatabase().select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, id))); }
