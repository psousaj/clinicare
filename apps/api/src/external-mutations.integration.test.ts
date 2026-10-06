import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { app } from './app';
import {
  appliedDocuments, appliedDocumentRevisions, authUsers, closeDatabase, contracts,
  contractVersions, documentCleanupJobs, followupContracts, followupItems,
  followupSnapshots, followups, getDatabase, migrateDatabase,
  planVersionContracts, planVersionItems, planVersions, plans, procedures,
  signatureEvents, signatureEvidence, signatureExternalAttempts, signatureExternalReceipts,
  signatureOperations, signatureParticipants, signaturePreviewCandidates, signatureProcesses, signatureRevisions,
  signatureTokens, tenants, patients,
} from '@clinicare/db';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, integrationHeaders, provisionIntegrationClinic } from './integration-support';
import { deleteObject, downloadObjectBytes, uploadObjectBytes } from './storage';
import { materializeAppliedDocumentResult, deleteAppliedDocument } from './clinical';
import { createHash, randomUUID } from 'node:crypto';
import { PDF } from '@libpdf/core';
import {
  buildSignedReturnPdf, createTestCa, ensureOpensslAvailable,
  issueDatedTestSigner, issueTestSigner, type TestCa, type TestSigner,
} from './external-test-fixtures';
import { revalidateEmbeddedSignatures } from './external-validation';

let sessionHeaders: Record<string, string>;
const request = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { ...sessionHeaders, ...(init.headers ?? {}) } });
const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { ...sessionHeaders }, body: JSON.stringify(body) });

const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const placement = { pageIndex: 0, x: 0.1, y: 0.2, width: 0.25, height: 0.12 };
const patientCpf = '52998224725';

integration('Issue #27: Preservar assinaturas externas em mutações posteriores', () => {
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  let patientId: string;
  let followupId: string;
  let tokenByProcess: Record<string, string>;
  let processIds: string[];
  let documentIds: string[];
  let pdfKeys: string[];
  let ca: TestCa;
  let patientSigner: TestSigner;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await ensureOpensslAvailable();
    await migrateDatabase();
    const db = getDatabase();
    await provisionIntegrationClinic(app, 'sig-mutations', tenantId);
    await provisionIntegrationClinic(app, 'sig-mutations-other', otherTenantId);
    sessionHeaders = integrationHeaders(tenantId);

    const patientRes = await request('/api/patients', json({ fullName: 'Paciente Mutações', phone: '11987654321', cpf: patientCpf }));
    expect(patientRes.status).toBe(201);
    patientId = ((await patientRes.json()) as any).id;

    const procedureId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento Mutação', durationMinutes: 30, priceCents: 500, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano Mutação' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 500 });
    await db.insert(planVersionItems).values({ tenantId, planVersionId: versionId, procedureId, sessions: 1, procedureName: 'Procedimento Mutação', durationMinutes: 30, priceCents: 500, sessionSchema: { type: 'object', properties: {} } });

    pdfKeys = [];
    for (const index of [1, 2, 3]) {
      const doc = PDF.create();
      doc.addPage({ width: 612, height: 792 });
      const pdfBytes = await doc.save();
      const pdfKey = randomUUID();
      await uploadObjectBytes(pdfKey, pdfBytes);
      pdfKeys.push(pdfKey);
      const contractId = crypto.randomUUID();
      const contractVersionId = crypto.randomUUID();
      await db.insert(contracts).values({ id: contractId, tenantId, title: `Contrato Mutação ${index}`, kind: 'standard' });
      await db.insert(contractVersions).values({
        id: contractVersionId, tenantId, contractId, version: 1, content: `Termos mutação ${index}`,
        renderedPdfObjectKey: pdfKey, renderedPdfHash: createHash('sha256').update(pdfBytes).digest('hex'),
        renderedPdfSize: pdfBytes.byteLength, renderedPdfContentType: 'application/pdf',
      });
      await db.insert(planVersionContracts).values({ tenantId, planVersionId: versionId, contractId, contractVersion: 1, title: `Contrato Mutação ${index}` });
    }

    const createRes = await request('/api/followups', json({ patientId, offerType: 'plan', offerId: planId }));
    expect(createRes.status).toBe(201);
    const created = await createRes.json() as any;
    followupId = created.id;
    tokenByProcess = {};
    for (const [processId, group] of Object.entries(created.signatureTokens) as Array<[string, any]>) {
      tokenByProcess[processId] = group.patient.token;
    }
    processIds = Object.keys(created.signatureTokens);

    documentIds = [];
    for (const contractRow of created.contracts as any[]) {
      const mat = await materializeAppliedDocumentResult(tenantId, contractRow.id);
      if (!mat.document) throw new Error('Documento aplicado não materializado.');
      documentIds.push(mat.document.id);
    }

    const dbgTokens = await db.select().from(signatureTokens).where(eq(signatureTokens.tenantId, tenantId));
    ca = await createTestCa('sig-mutations-flow');
    patientSigner = await issueTestSigner(ca, { commonName: 'Paciente Mutação', cpfDigits: patientCpf, email: 'paciente-mutacao@example.test' });
    process.env.GOVBR_TRUSTED_ROOTS = ca.caPem;
  });

  afterAll(async () => {
    delete process.env.GOVBR_TRUSTED_ROOTS;
    const db = getDatabase();
    for (const table of [
      signatureEvidence, signatureEvents, signatureRevisions, signatureOperations,
      signatureExternalReceipts, signatureExternalAttempts,
      signaturePreviewCandidates, signatureTokens, signatureParticipants, signatureProcesses,
    ]) {
      await db.delete(table as any).where(eq((table as any).tenantId, tenantId));
      await db.delete(table as any).where(eq((table as any).tenantId, otherTenantId));
    }
    for (const documentId of documentIds ?? []) {
      await deleteAppliedDocument(tenantId, documentId).catch(() => null);
    }
    for (const pdfKey of pdfKeys ?? []) {
      await deleteObject(pdfKey).catch(() => null);
    }
    for (const table of [
      documentCleanupJobs, followupContracts, followupItems, followupSnapshots,
      followups, planVersionContracts, planVersionItems, planVersions, plans,
      contractVersions, contracts, procedures, patients,
    ]) {
      await db.delete(table as any).where(eq((table as any).tenantId, tenantId));
      await db.delete(table as any).where(eq((table as any).tenantId, otherTenantId));
    }
    await cleanupIntegrationClinics([tenantId, otherTenantId]);
    await closeDatabase();
  });

  const readDocument = async (token: string) => {
    const verified = await request(`/public/signatures/${token}/verify-phone`, json({ phoneLast4: '4321' }));
    expect(verified.status).toBe(200);
    const current = await request(`/public/signatures/${token}`);
    expect(current.status).toBe(200);
    return ((await current.json()) as any) as { document: { id: string; revisionId: string; version: number; hash: string }; hasExternalSignatures: boolean };
  };

  // Leitura do HEAD via banco para etapas pós-confirmação: o token público
  // é revogado quando o participante assina e não pode ser reutilizado.
  const readHead = async (documentId: string) => {
    const db = getDatabase();
    const row = (await db.select({ document: appliedDocuments, revision: appliedDocumentRevisions }).from(appliedDocuments).innerJoin(appliedDocumentRevisions, and(eq(appliedDocumentRevisions.tenantId, appliedDocuments.tenantId), eq(appliedDocumentRevisions.id, appliedDocuments.currentRevisionId))).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId))))[0]!;
    const origins = await db.select({ origin: appliedDocumentRevisions.origin }).from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, documentId)));
    return {
      document: { id: row.document.id, revisionId: row.revision.id, version: row.revision.version, hash: row.revision.contentHash },
      hasExternalSignatures: origins.some((r) => r.origin === 'govbr_external'),
    };
  };

  const localConfirm = async (token: string, document: { id: string; revisionId: string }) => {
    const idempotencyKey = randomUUID();
    const previewRes = await request(`/public/signatures/${token}/preview`, json({
      documentId: document.id, baseRevisionId: document.revisionId, signaturePng: pngDataUrl, placement,
      idempotencyKey, fingerprint: { visitorId: 'vis-local', version: 'fingerprintjs-oss-5' }, previewOnly: true,
    }));
    expect(previewRes.status).toBe(200);
    const previewHash = previewRes.headers.get('etag')!.replaceAll('"', '');
    const confirmRes = await request(`/public/signatures/${token}/confirm`, json({ evidence: {
      documentId: document.id, baseRevisionId: document.revisionId, signaturePng: pngDataUrl, placement,
      idempotencyKey, previewHash, fingerprint: { visitorId: 'vis-local', version: 'fingerprintjs-oss-5' },
      confirmed: true, acceptanceText: 'aceito local',
    } }));
    expect(confirmRes.status).toBe(200);
  };

  const externalConfirm = async (token: string, document: { id: string; revisionId: string }, signer: TestSigner, fingerprintVisitor: string) => {
    const exportRes = await request(`/public/signatures/${token}/external/export`, json({
      documentId: document.id, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: `${fingerprintVisitor}-export`, version: 'fingerprintjs-oss-5' },
    }));
    expect(exportRes.status).toBe(200);
    const { attemptId } = await exportRes.json() as any;
    const exportBytes = new Uint8Array(await (await request(`/public/signatures/${token}/external/${attemptId}/file`)).arrayBuffer());
    const signedBytes = await buildSignedReturnPdf(exportBytes, signer, ca.dir);
    const importRes = await request(`/public/signatures/${token}/external/import`, json({
      attemptId, pdfBase64: Buffer.from(signedBytes).toString('base64'),
      fingerprint: { visitorId: `${fingerprintVisitor}-import`, version: 'fingerprintjs-oss-5' },
    }));
    expect(importRes.status).toBe(200);
    const imported = await importRes.json() as any;
    expect(imported.validationStatus).toBe('validada');
    const confirmRes = await request(`/public/signatures/${token}/external/confirm`, json({
      attemptId, idempotencyKey: randomUUID(),
      fingerprint: { visitorId: `${fingerprintVisitor}-accept`, version: 'fingerprintjs-oss-5' },
      acceptanceText: 'Confirmo a assinatura realizada no GOV.BR', confirmed: true,
    }));
    expect(confirmRes.status).toBe(200);
    return { attemptId, receiptId: imported.receiptId as string };
  };

  it('rejects returns signed with an expired certificate', async () => {
    const db = getDatabase();
    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    // Usa o representante do contrato 1 via sessão: exportar não exige
    // participante pendente, apenas sessão válida do tenant.
    const representative = participants.find((p) => p.role === 'professional')!;
    const document = await currentDocumentOf(db, representative.processId);
    const expired = await issueDatedTestSigner(ca, {
      commonName: 'Expirado', cpfDigits: patientCpf, email: 'expirado@example.test',
      startDate: '20200101000000Z', endDate: '20210101000000Z',
    });
    const exportRes = await request(`/api/signature-participants/${representative.id}/external/export`, json({
      documentId: document.documentId, baseRevisionId: document.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-exp', version: 'fingerprintjs-oss-5' },
    }));
    expect(exportRes.status).toBe(200);
    const { attemptId } = await exportRes.json() as any;
    const exportBytes = new Uint8Array(await (await request(`/api/signature-participants/${representative.id}/external/${attemptId}/file`)).arrayBuffer());
    const signedBytes = await buildSignedReturnPdf(exportBytes, expired, ca.dir);
    const importRes = await request(`/api/signature-participants/${representative.id}/external/import`, json({
      attemptId, pdfBase64: Buffer.from(signedBytes).toString('base64'),
      fingerprint: { visitorId: 'vis-exp-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(importRes.status).toBe(200);
    const imported = await importRes.json() as any;
    expect(imported.validationStatus).toBe('inválida');
    expect(imported.reason).toBe('certificate_not_valid');
    const head = (await db.select().from(appliedDocuments).where(eq(appliedDocuments.id, document.documentId)))[0]!;
    expect(head.currentRevisionId).toBe(document.revisionId);
  });

  it('chains local then external preserving every prefix', async () => {
    const db = getDatabase();
    const sessionUser = (await db.select().from(authUsers).where(eq(authUsers.tenantId, tenantId)))[0]!;
    const repSigner = await issueTestSigner(ca, { commonName: 'Representante Mutação', cpfDigits: '11144477735', email: sessionUser.email });
    const token = tokenByProcess[processIds[0]!]!;
    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    const processes = await db.select().from(signatureProcesses).where(eq(signatureProcesses.tenantId, tenantId));
    const processId = processes.find((p) => tokenByProcess[p.id] === token)!.id;
    const representative = participants.find((p) => p.processId === processId && p.role === 'professional')!;

    const v1 = (await readDocument(token)).document;
    expect((await readDocument(token)).hasExternalSignatures).toBe(false);

    await localConfirm(token, v1);
    const v2 = (await readHead(v1.id)).document;
    expect(v2.version).toBe(2);

    // Representante assina externamente sobre a revisão manuscrita, pelo painel.
    const repDoc = await currentDocumentOf(db, representative.processId);
    expect(repDoc.revisionId).toBe(v2.revisionId);
    const repExport = await request(`/api/signature-participants/${representative.id}/external/export`, json({
      documentId: repDoc.documentId, baseRevisionId: repDoc.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-rep-export', version: 'fingerprintjs-oss-5' },
    }));
    expect(repExport.status).toBe(200);
    const repAttempt = (await repExport.json() as any).attemptId;
    const repExportBytes = new Uint8Array(await (await request(`/api/signature-participants/${representative.id}/external/${repAttempt}/file`)).arrayBuffer());
    const repSigned = await buildSignedReturnPdf(repExportBytes, repSigner, ca.dir);
    const repImport = await request(`/api/signature-participants/${representative.id}/external/import`, json({
      attemptId: repAttempt, pdfBase64: Buffer.from(repSigned).toString('base64'),
      fingerprint: { visitorId: 'vis-rep-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(repImport.status).toBe(200);
    expect((await repImport.json() as any).validationStatus).toBe('validada');
    const repConfirm = await request(`/api/signature-participants/${representative.id}/external/confirm`, json({
      attemptId: repAttempt, idempotencyKey: randomUUID(),
      fingerprint: { visitorId: 'vis-rep-accept', version: 'fingerprintjs-oss-5' },
      acceptanceText: 'aceito pelo representante', confirmed: true,
    }));
    expect(repConfirm.status).toBe(200);
    expect((await repConfirm.json() as any).processCompleted).toBe(true);

    const v3 = await readHead(v1.id);
    expect(v3.document.version).toBe(3);
    expect(v3.hasExternalSignatures).toBe(true);

    const revisions = (await db.select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, v1.id)))).sort((a, b) => a.version - b.version);
    expect(revisions.map((r) => r.origin)).toEqual(['initial', 'local_handwritten', 'govbr_external']);
    const bytes = [];
    for (const revision of revisions) {
      bytes.push(await downloadObjectBytes(revision.objectKey));
    }
    for (let i = 1; i < bytes.length; i++) {
      expect(Array.from(bytes[i]!.subarray(0, bytes[i - 1]!.byteLength))).toEqual(Array.from(bytes[i - 1]!));
    }
    // A assinatura externa continua revalidável após as mutações.
    const revalidation = await revalidateEmbeddedSignatures(bytes[2]!, { trustedRootPems: [ca.caPem] });
    expect(revalidation.ok).toBe(true);
    expect(revalidation.signatures).toHaveLength(1);
    expect(revalidation.signatures[0]).toMatchObject({ digestMatch: true, cmsValid: true, chain: 'trusted', certificateValid: true });
    // Nenhuma tentativa foi bloqueada pela revalidação neste fluxo.
    const blocked = await db.select().from(signatureEvents).where(and(eq(signatureEvents.tenantId, tenantId), eq(signatureEvents.type, 'revalidation_failed')));
    expect(blocked).toHaveLength(0);
  });

  it('chains two external signatures preserving and revalidating both', async () => {
    const db = getDatabase();
    const sessionUser = (await db.select().from(authUsers).where(eq(authUsers.tenantId, tenantId)))[0]!;
    const repSigner = await issueTestSigner(ca, { commonName: 'Representante Mutação 2', cpfDigits: '11144477735', email: sessionUser.email });
    const token = tokenByProcess[processIds[1]!]!;
    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    const processes = await db.select().from(signatureProcesses).where(eq(signatureProcesses.tenantId, tenantId));
    const processId = processes.find((p) => tokenByProcess[p.id] === token)!.id;
    const representative = participants.find((p) => p.processId === processId && p.role === 'professional')!;
    const v1 = (await readDocument(token)).document;

    await externalConfirm(token, v1, patientSigner, 'vis-gg1');
    const v2 = (await readHead(v1.id)).document;
    expect(v2.version).toBe(2);

    const repDoc = await currentDocumentOf(db, representative.processId);
    expect(repDoc.revisionId).toBe(v2.revisionId);
    const repExport = await request(`/api/signature-participants/${representative.id}/external/export`, json({
      documentId: repDoc.documentId, baseRevisionId: repDoc.revisionId,
      idempotencyKey: randomUUID(), fingerprint: { visitorId: 'vis-gg2-export', version: 'fingerprintjs-oss-5' },
    }));
    expect(repExport.status).toBe(200);
    const repAttempt = (await repExport.json() as any).attemptId;
    const repExportBytes = new Uint8Array(await (await request(`/api/signature-participants/${representative.id}/external/${repAttempt}/file`)).arrayBuffer());
    const repSigned = await buildSignedReturnPdf(repExportBytes, repSigner, ca.dir);
    const repImport = await request(`/api/signature-participants/${representative.id}/external/import`, json({
      attemptId: repAttempt, pdfBase64: Buffer.from(repSigned).toString('base64'),
      fingerprint: { visitorId: 'vis-gg2-import', version: 'fingerprintjs-oss-5' },
    }));
    expect(repImport.status).toBe(200);
    const repImported = await repImport.json() as any;
    expect(repImported.validationStatus).toBe('validada');
    const repConfirm = await request(`/api/signature-participants/${representative.id}/external/confirm`, json({
      attemptId: repAttempt, idempotencyKey: randomUUID(),
      fingerprint: { visitorId: 'vis-gg2-accept', version: 'fingerprintjs-oss-5' },
      acceptanceText: 'aceito pelo representante', confirmed: true,
    }));
    expect(repConfirm.status).toBe(200);
    expect((await repConfirm.json() as any).processCompleted).toBe(true);

    const v3 = (await readHead(v1.id)).document;
    expect(v3.version).toBe(3);

    const revisions = (await db.select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, v1.id)))).sort((a, b) => a.version - b.version);
    expect(revisions.map((r) => r.origin)).toEqual(['initial', 'govbr_external', 'govbr_external']);
    const v3bytes = await downloadObjectBytes(revisions[2]!.objectKey);
    const v2bytes = await downloadObjectBytes(revisions[1]!.objectKey);
    expect(Array.from(v3bytes.subarray(0, v2bytes.byteLength))).toEqual(Array.from(v2bytes));
    const revalidation = await revalidateEmbeddedSignatures(v3bytes, { trustedRootPems: [ca.caPem] });
    expect(revalidation.ok).toBe(true);
    expect(revalidation.signatures).toHaveLength(2);
    expect(revalidation.signatures.every((s) => s.digestMatch && s.cmsValid && s.certificateValid)).toBe(true);
    const secondReceipt = (await db.select().from(signatureExternalReceipts).where(and(eq(signatureExternalReceipts.tenantId, tenantId), eq(signatureExternalReceipts.id, repImported.receiptId))))[0]!;
    expect(secondReceipt.coveredRevisionIds).toEqual([v2.revisionId]);
    expect(secondReceipt.promotedRevisionId).toBe(revisions[2]!.id);
  });

  it('chains external then local preserving every prefix', async () => {
    const db = getDatabase();
    const token = tokenByProcess[processIds[2]!]!;
    const participants = await db.select().from(signatureParticipants).where(eq(signatureParticipants.tenantId, tenantId));
    const processes = await db.select().from(signatureProcesses).where(eq(signatureProcesses.tenantId, tenantId));
    const processId = processes.find((p) => tokenByProcess[p.id] === token)!.id;
    const representative = participants.find((p) => p.processId === processId && p.role === 'professional')!;
    const v1 = (await readDocument(token)).document;

    await externalConfirm(token, v1, patientSigner, 'vis-gl1');
    const v2 = (await readHead(v1.id)).document;
    expect(v2.version).toBe(2);

    // Mutação manuscrita do representante sobre a revisão externa, pelo painel.
    const repDoc = await currentDocumentOf(db, representative.processId);
    expect(repDoc.revisionId).toBe(v2.revisionId);
    const proIdempotencyKey = randomUUID();
    const proPreview = await request(`/api/signature-participants/${representative.id}/preview`, json({
      documentId: repDoc.documentId, baseRevisionId: repDoc.revisionId, signaturePng: pngDataUrl, placement,
      idempotencyKey: proIdempotencyKey, fingerprint: { visitorId: 'vis-gl-local', version: 'fingerprintjs-oss-5' }, previewOnly: true,
    }));
    expect(proPreview.status).toBe(200);
    const proPreviewHash = proPreview.headers.get('etag')!.replaceAll('"', '');
    const proConfirm = await request(`/api/signature-participants/${representative.id}/confirm`, json({ evidence: {
      documentId: repDoc.documentId, baseRevisionId: repDoc.revisionId, signaturePng: pngDataUrl, placement,
      idempotencyKey: proIdempotencyKey, previewHash: proPreviewHash, fingerprint: { visitorId: 'vis-gl-local', version: 'fingerprintjs-oss-5' },
      confirmed: true, acceptanceText: 'aceito local',
    } }));
    expect(proConfirm.status).toBe(200);
    expect((await proConfirm.json() as any).processCompleted).toBe(true);

    const v3 = (await readHead(v1.id)).document;
    expect(v3.version).toBe(3);
    const revisions = (await db.select().from(appliedDocumentRevisions).where(and(eq(appliedDocumentRevisions.tenantId, tenantId), eq(appliedDocumentRevisions.documentId, v1.id)))).sort((a, b) => a.version - b.version);
    expect(revisions.map((r) => r.origin)).toEqual(['initial', 'govbr_external', 'local_handwritten']);
    const bytes = [];
    for (const revision of revisions) {
      bytes.push(await downloadObjectBytes(revision.objectKey));
    }
    for (let i = 1; i < bytes.length; i++) {
      expect(Array.from(bytes[i]!.subarray(0, bytes[i - 1]!.byteLength))).toEqual(Array.from(bytes[i - 1]!));
    }
    const revalidation = await revalidateEmbeddedSignatures(bytes[2]!, { trustedRootPems: [ca.caPem] });
    expect(revalidation.ok).toBe(true);
    expect(revalidation.signatures).toHaveLength(1);
  });


  async function currentDocumentOf(db: ReturnType<typeof getDatabase>, processId: string) {
    const process = (await db.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.id, processId))))[0]!;
    const row = (await db.select({ document: appliedDocuments, revision: appliedDocumentRevisions }).from(appliedDocuments).innerJoin(appliedDocumentRevisions, and(eq(appliedDocumentRevisions.tenantId, appliedDocuments.tenantId), eq(appliedDocumentRevisions.id, appliedDocuments.currentRevisionId))).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.followupContractId, process.followupContractId))))[0]!;
    return { documentId: row.document.id, revisionId: row.revision.id };
  }
});
