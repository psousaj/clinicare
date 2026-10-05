import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq, sql } from 'drizzle-orm';
import { app } from './app';
import {
  appliedDocuments, appliedDocumentRevisions, closeDatabase, contracts,
  contractVersions, documentCleanupJobs, followupContracts, followups, getDatabase,
  migrateDatabase, patients, planVersionContracts, planVersionItems,
  planVersions, plans, procedures, tenants, signatureEvents, signatureTokens,
  signatureParticipants, signatureProcesses, followupItems, followupSnapshots,
  encryptValue, buildPatientAad
} from '@clinicare/db';
import {
  assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration,
  integrationHeaders, provisionIntegrationClinic
} from './integration-support';
import { uploadObjectBytes } from './storage';
import { materializeAppliedDocumentResult, getAppliedDocument, deleteAppliedDocument } from './clinical';
import { createHash, randomUUID } from 'node:crypto';

let sessionHeaders: Record<string, string>;
const request = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { ...sessionHeaders, ...(init.headers ?? {}) } });
const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { ...sessionHeaders },
  body: JSON.stringify(body)
});

integration('Issue #22: Materializar Documento PDF do contrato aplicado', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  let patientId: string;
  let otherPatientId: string;
  let planId: string;
  let otherPlanId: string;
  let versionId: string;
  let otherVersionId: string;
  let contractId: string;
  let contractVersionId: string;
  let originalPdfBytes: Uint8Array;
  let originalPdfHash: string;
  let originalPdfKey: string;
  let createdDocumentId: string | null = null;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    const db = getDatabase();
    await provisionIntegrationClinic(app, 'applied-docs', tenantId);
    await provisionIntegrationClinic(app, 'applied-docs-other', otherTenantId);
    sessionHeaders = integrationHeaders(tenantId);

    patientId = crypto.randomUUID();
    otherPatientId = crypto.randomUUID();
    const procedureId = crypto.randomUUID();
    planId = crypto.randomUUID();
    otherPlanId = crypto.randomUUID();
    versionId = crypto.randomUUID();
    otherVersionId = crypto.randomUUID();
    contractId = crypto.randomUUID();
    contractVersionId = crypto.randomUUID();

    const phoneEnc = encryptValue('11987654321', buildPatientAad(tenantId, patientId, 'phone', 1));
    await db.insert(patients).values([
      {
        id: patientId,
        tenantId,
        fullName: 'Paciente Contrato Materializado',
        phoneCiphertext: phoneEnc.ciphertext,
        phoneNonce: phoneEnc.nonce,
        phoneKeyVersion: 1
      },
      {
        id: otherPatientId,
        tenantId,
        fullName: 'Segundo Paciente',
        phoneCiphertext: phoneEnc.ciphertext,
        phoneNonce: phoneEnc.nonce,
        phoneKeyVersion: 1
      }
    ]);

    await db.insert(procedures).values({
      id: procedureId,
      tenantId,
      name: 'Procedimento Geral',
      durationMinutes: 30,
      priceCents: 1000,
      sessionSchema: { type: 'object', properties: {} }
    });

    await db.insert(plans).values([
      { id: planId, tenantId, name: 'Plano com Contrato' },
      { id: otherPlanId, tenantId, name: 'Outro Plano' }
    ]);
    await db.insert(planVersions).values([
      { id: versionId, tenantId, planId, version: 1, priceCents: 1000 },
      { id: otherVersionId, tenantId, planId: otherPlanId, version: 1, priceCents: 1000 }
    ]);
    await db.insert(planVersionItems).values([
      {
        tenantId,
        planVersionId: versionId,
        procedureId,
        sessions: 1,
        procedureName: 'Procedimento Geral',
        durationMinutes: 30,
        priceCents: 1000,
        sessionSchema: { type: 'object', properties: {} }
      },
      {
        tenantId,
        planVersionId: otherVersionId,
        procedureId,
        sessions: 1,
        procedureName: 'Procedimento Geral',
        durationMinutes: 30,
        priceCents: 1000,
        sessionSchema: { type: 'object', properties: {} }
      }
    ]);

    originalPdfBytes = new TextEncoder().encode('%PDF-1.4\n% applied document original fixture\n');
    originalPdfHash = createHash('sha256').update(originalPdfBytes).digest('hex');
    originalPdfKey = randomUUID();
    await uploadObjectBytes(originalPdfKey, originalPdfBytes);

    await db.insert(contracts).values({ id: contractId, tenantId, title: 'Termo de Consentimento', kind: 'standard' });
    await db.insert(contractVersions).values({
      id: contractVersionId,
      tenantId,
      contractId,
      version: 1,
      content: 'Cláusula 1...',
      renderedPdfObjectKey: originalPdfKey,
      renderedPdfHash: originalPdfHash,
      renderedPdfSize: originalPdfBytes.byteLength,
      renderedPdfContentType: 'application/pdf'
    });
    await db.insert(planVersionContracts).values({
      tenantId,
      planVersionId: versionId,
      contractId,
      title: 'Termo de Consentimento'
    });
  });

  afterAll(async () => {
    if (createdDocumentId) {
      await deleteAppliedDocument(tenantId, createdDocumentId).catch(() => null);
    }
    const db = getDatabase();
    for (const table of [
      documentCleanupJobs, signatureEvents, signatureTokens, signatureParticipants,
      signatureProcesses, followupContracts, followupItems, followupSnapshots, followups, planVersionContracts,
      planVersionItems, planVersions, plans, contractVersions, contracts, procedures, patients
    ]) {
      await db.delete(table as any).where(eq((table as any).tenantId, tenantId));
      await db.delete(table as any).where(eq((table as any).tenantId, otherTenantId));
    }
    await cleanupIntegrationClinics([tenantId, otherTenantId]);
    await closeDatabase();
  });

  it('cria contrato aplicado e materializa documento PDF como artefato técnico versionado distinto', async () => {
    const createRes = await request('/api/followups', json({ patientId, offerType: 'plan', offerId: planId }));
    expect(createRes.status).toBe(201);
    const followup = await createRes.json() as any;
    expect(followup.contracts).toHaveLength(1);
    const followupContractId = followup.contracts[0].id;

    // Materializa o documento associado ao followup_contract
    const matResult = await materializeAppliedDocumentResult(tenantId, followupContractId);
    expect(matResult.document).toBeDefined();
    if (!matResult.document) throw new Error('Documento aplicado não materializado.');
    expect(matResult.document.followupContractId).toBe(followupContractId);
    expect(matResult.document.originalHash).toBe(originalPdfHash);
    expect(matResult.document.originalSize).toBe(originalPdfBytes.byteLength);
    expect(matResult.document.currentRevisionId).toBeDefined();
    createdDocumentId = matResult.document.id;

    const db = getDatabase();
    // Verifica separação entre followup_contract e applied_document
    const storedContract = (await db.select().from(followupContracts).where(eq(followupContracts.id, followupContractId)))[0]!;
    expect(storedContract.id).toBe(followupContractId);
    expect(storedContract.id).not.toBe(matResult.document.id);

    // Verifica que existe revisão inicial version 1 imutável apontando para HEAD
    const revs = await db.select().from(appliedDocumentRevisions).where(eq(appliedDocumentRevisions.documentId, matResult.document.id));
    expect(revs).toHaveLength(1);
    expect(revs[0]!.version).toBe(1);
    expect(revs[0]!.id).toBe(matResult.document.currentRevisionId!);
    expect(revs[0]!.contentHash).toBe(originalPdfHash);
    expect(revs[0]!.parentRevisionId).toBeNull();
  });

  it('permite leitura autorizada do documento com HEAD, versão, hash e bloqueia outro tenant', async () => {
    const db = getDatabase();
    const doc = (await db.select().from(appliedDocuments).where(eq(appliedDocuments.tenantId, tenantId)))[0]!;
    expect(doc).toBeDefined();

    // Leitura autorizada pelo próprio tenant
    const read = await getAppliedDocument(tenantId, doc.id);
    expect(read).toBeDefined();
    if (!read) throw new Error('Documento aplicado não encontrado.');
    expect(read.id).toBe(doc.id);
    expect(read.currentRevisionId).toBe(doc.currentRevisionId);
    expect(read.originalHash).toBe(originalPdfHash);

    // Acesso por outro tenant deve retornar null
    const otherRead = await getAppliedDocument(otherTenantId, doc.id);
    expect(otherRead).toBeNull();
  });

  it('rejeita materialização se a versão do contrato não possuir PDF renderizado válido', async () => {
    const db = getDatabase();
    const invalidContractId = crypto.randomUUID();
    const invalidVersionId = crypto.randomUUID();

    await db.insert(contracts).values({ id: invalidContractId, tenantId, title: 'Sem PDF', kind: 'standard' });
    await db.insert(contractVersions).values({
      id: invalidVersionId,
      tenantId,
      contractId: invalidContractId,
      version: 1,
      content: 'Sem PDF',
      renderedPdfObjectKey: null,
      renderedPdfHash: null,
      renderedPdfSize: null,
      renderedPdfContentType: null
    });

    const followupId = crypto.randomUUID();
    await db.insert(followups).values({
      id: followupId,
      tenantId,
      patientId: otherPatientId,
      offerType: 'plan',
      offerId: otherPlanId,
      planId: otherPlanId,
      planVersionId: otherVersionId,
      status: 'idle',
      offerNameSnapshot: 'Outro Plano',
      priceCents: 1000
    });

    const followupContractId = crypto.randomUUID();
    await db.insert(followupContracts).values({
      id: followupContractId,
      tenantId,
      followupId,
      contractId: invalidContractId,
      contractVersion: 1,
      titleSnapshot: 'Sem PDF',
      contentCiphertext: 'cipher',
      contentNonce: 'nonce',
      contentKeyVersion: 1,
      renderedPdfObjectKey: null,
      renderedPdfHash: null,
      renderedPdfSize: null,
      renderedPdfContentType: null
    });

    await expect(materializeAppliedDocumentResult(tenantId, followupContractId)).rejects.toThrow(
      'O contrato aplicado não possui PDF renderizado verificado.'
    );
  });
});
