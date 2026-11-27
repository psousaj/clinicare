import { afterAll, beforeAll, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import PizZip from 'pizzip';
import { appliedDocuments, clinicSubscriptions, closeDatabase, contractVersions, contracts, documentCleanupJobs, followupContracts, followupItems, followupSnapshots, followups, getDatabase, migrateDatabase, patients, planVersionContracts, planVersionItems, planVersions, plans, procedures, procedureVersions, signatureEvents, signatureParticipants, signatureProcesses, signatureTokens } from '@clinicare/db';
import { app } from './app';
import { defaultContextConfiguration } from './contract-materialization';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';
import { deleteObject, downloadObjectBytes, verifyObject } from './storage';
import { deleteAppliedDocument } from './clinical';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function docxWithPatientPlaceholder(suffix = '') {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Contrato de {patient.name}${suffix}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generate({ type: 'uint8array' });
}

integration('Free DOCX import and Standard contract generation with PostgreSQL and real storage', () => {
  const tenantIds: string[] = [];
  let clinic: IntegrationClinic;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    clinic = await provisionIntegrationClinic(app, 'contracts-freemium');
    tenantIds.push(clinic.tenantId);
  });

  afterAll(async () => {
    if (tenantIds.length) {
      const db = getDatabase();
      const [modelRows, versionRows, appliedRows, documents] = await Promise.all([
        db.select({ key: contracts.draftDocxObjectKey }).from(contracts).where(eq(contracts.tenantId, clinic.tenantId)),
        db.select({ key: contractVersions.sourceDocxObjectKey }).from(contractVersions).where(eq(contractVersions.tenantId, clinic.tenantId)),
        db.select({ docx: followupContracts.materializedDocxObjectKey, pdf: followupContracts.renderedPdfObjectKey }).from(followupContracts).where(eq(followupContracts.tenantId, clinic.tenantId)),
        db.select({ id: appliedDocuments.id }).from(appliedDocuments).where(eq(appliedDocuments.tenantId, clinic.tenantId)),
      ]);
      for (const document of documents) await deleteAppliedDocument(clinic.tenantId, document.id).catch(() => undefined);
      const keys = new Set([
        ...modelRows.map((row) => row.key),
        ...versionRows.map((row) => row.key),
        ...appliedRows.flatMap((row) => [row.docx, row.pdf]),
      ].filter((key): key is string => Boolean(key)));
      await Promise.all([...keys].map((key) => deleteObject(key).catch(() => undefined)));
      for (const table of [documentCleanupJobs, signatureEvents, signatureTokens, signatureParticipants, signatureProcesses, followupContracts, planVersionContracts, planVersionItems, followupSnapshots, followupItems, followups, planVersions, clinicSubscriptions, contractVersions, contracts, plans, procedureVersions, procedures, patients]) {
        await getDatabase().delete(table).where(eq((table as any).tenantId, clinic.tenantId));
      }
      await cleanupIntegrationClinics(tenantIds);
    }
    await closeDatabase();
  });

  it('imports and retrieves a Free DOCX, then configures and materializes that same model on Standard', async () => {
    const freeHeaders = clinic.headers();
    const source = docxWithPatientPlaceholder();
    const sourceHash = sha256(source);
    const modelResponse = await app.request('/api/contracts', {
      method: 'POST', headers: freeHeaders,
      body: JSON.stringify({ title: 'Modelo importado no Free', kind: 'standard' }),
    });
    expect(modelResponse.status).toBe(201);
    const model = await modelResponse.json() as { id: string };

    const presign = await app.request(`/api/contracts/${model.id}/draft/presign`, {
      method: 'POST', headers: freeHeaders, body: JSON.stringify({}),
    });
    expect(presign.status).toBe(200);
    const uploadIntent = await presign.json() as { objectKey: string; uploadUrl: string };
    const uploaded = await fetch(uploadIntent.uploadUrl, { method: 'PUT', headers: { 'content-type': DOCX }, body: source });
    expect(uploaded.ok).toBe(true);
    const saved = await app.request(`/api/contracts/${model.id}/draft`, {
      method: 'PUT', headers: freeHeaders,
      body: JSON.stringify({ objectKey: uploadIntent.objectKey, contentType: DOCX, contentHash: sourceHash, size: source.byteLength }),
    });
    expect(saved.status).toBe(200);

    const listed = await (await app.request('/api/contracts', { headers: freeHeaders })).json() as Array<{ id: string; draftDocxHash: string; draftDocxSize: number; versions: unknown[] }>;
    const listedModel = listed.find((item) => item.id === model.id)!;
    expect(listedModel).toMatchObject({ draftDocxHash: sourceHash, draftDocxSize: source.byteLength, versions: [] });
    const draftDownload = await app.request(`/api/contracts/${model.id}/draft/editor`, { headers: freeHeaders });
    expect(draftDownload.status).toBe(200);
    const draftUrl = (await draftDownload.json() as { documentUrl: string }).documentUrl;
    expect(await verifyObject(uploadIntent.objectKey, sourceHash, source.byteLength, DOCX)).toBe(true);
    expect(Buffer.from(await (await fetch(draftUrl)).arrayBuffer())).toEqual(Buffer.from(source));
    expect(await getDatabase().select().from(appliedDocuments).where(eq(appliedDocuments.tenantId, clinic.tenantId))).toHaveLength(0);
    expect((await app.request(`/api/contracts/${model.id}/draft/configuration`, {
      method: 'PUT', headers: freeHeaders,
      body: JSON.stringify({ contexts: defaultContextConfiguration(), allowedPlaceholders: ['patient.name'], requiredPlaceholders: ['patient.name'] }),
    })).status).toBe(403);
    expect((await app.request(`/api/contracts/${model.id}/publish`, { method: 'POST', headers: freeHeaders, body: '{}' })).status).toBe(403);

    await getDatabase().insert(clinicSubscriptions).values({ tenantId: clinic.tenantId, planId: 'standard', status: 'active', startedAt: new Date() });
    const standardHeaders = clinic.headers();
    const contexts = { ...defaultContextConfiguration(), patient: { enabled: true, required: true } };
    const configured = await app.request(`/api/contracts/${model.id}/draft/configuration`, {
      method: 'PUT', headers: standardHeaders,
      body: JSON.stringify({ contexts, allowedPlaceholders: ['patient.name'], requiredPlaceholders: ['patient.name'] }),
    });
    expect(configured.status).toBe(200);
    expect((await configured.json() as { hash: string })).toHaveProperty('hash', sourceHash);
    const published = await app.request(`/api/contracts/${model.id}/publish`, { method: 'POST', headers: standardHeaders, body: '{}' });
    expect(published.status).toBe(201);
    const persistedModel = (await getDatabase().select().from(contracts).where(eq(contracts.id, model.id)))[0]!;
    const publishedVersion = (await getDatabase().select().from(contractVersions).where(eq(contractVersions.contractId, model.id)))[0]!;
    expect(persistedModel.draftDocxObjectKey).toBe(uploadIntent.objectKey);
    expect(persistedModel.draftDocxHash).toBe(sourceHash);
    expect(publishedVersion.sourceDocxHash).toBe(sourceHash);
    expect(Buffer.from(await downloadObjectBytes(publishedVersion.sourceDocxObjectKey!))).toEqual(Buffer.from(source));

    const patientResponse = await app.request('/api/patients', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ fullName: 'Paciente de contrato', phone: '11987654321' }),
    });
    expect(patientResponse.status).toBe(201);
    const patient = await patientResponse.json() as { id: string };
    expect((await app.request('/api/auth/professional-profile', {
      method: 'PUT', headers: standardHeaders,
      body: JSON.stringify({ registrationType: 'CRM', registrationNumber: '12345', registrationState: 'SP' }),
    })).status).toBe(200);
    const procedureResponse = await app.request('/api/procedures', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ name: 'Procedimento do contrato', durationMinutes: 30, priceCents: 1000 }),
    });
    expect(procedureResponse.status).toBe(201);
    const procedure = await procedureResponse.json() as { id: string };
    const planResponse = await app.request('/api/plans', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ name: 'Plano do contrato', priceCents: 1000, items: [{ offerType: 'procedure', offerId: procedure.id, sessions: 1 }], contractIds: [model.id] }),
    });
    expect(planResponse.status).toBe(201);
    const plan = await planResponse.json() as { id: string };
    const followupResponse = await app.request('/api/followups', {
      method: 'POST', headers: standardHeaders,
      body: JSON.stringify({ patientId: patient.id, offerType: 'plan', offerId: plan.id }),
    });
    expect(followupResponse.status).toBe(201);
    const followup = await followupResponse.json() as { id: string; contracts: Array<{ id: string }> };
    const appliedId = followup.contracts[0]!.id;
    let applied: typeof followupContracts.$inferSelect | undefined;
    for (let attempt = 0; attempt < 900; attempt++) {
      applied = (await getDatabase().select().from(followupContracts).where(eq(followupContracts.id, appliedId)))[0];
      if (applied?.status === 'ready' || applied?.status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(applied?.status, applied?.generationError ?? 'contract generation did not finish').toBe('ready');
    expect(applied?.materializedDocxHash).toBeTruthy();
    expect(applied?.renderedPdfHash).toBeTruthy();
    const materializedDocx = await downloadObjectBytes(applied!.materializedDocxObjectKey!);
    const renderedPdf = await downloadObjectBytes(applied!.renderedPdfObjectKey!);
    expect(sha256(materializedDocx)).toBe(applied!.materializedDocxHash!);
    expect(sha256(renderedPdf)).toBe(applied!.renderedPdfHash!);
    expect(await verifyObject(applied!.materializedDocxObjectKey!, applied!.materializedDocxHash!, applied!.materializedDocxSize!, DOCX)).toBe(true);
    expect(await verifyObject(applied!.renderedPdfObjectKey!, applied!.renderedPdfHash!, applied!.renderedPdfSize!, 'application/pdf')).toBe(true);
    expect(new TextDecoder().decode(renderedPdf.subarray(0, 5))).toBe('%PDF-');
    expect(new PizZip(materializedDocx).file('word/document.xml')!.asText()).toContain('Paciente de contrato');
    expect(new PizZip(materializedDocx).file('word/document.xml')!.asText()).not.toContain('{patient.name}');

    await getDatabase().update(clinicSubscriptions).set({ status: 'paused' }).where(eq(clinicSubscriptions.tenantId, clinic.tenantId));
    const document = (await getDatabase().select().from(appliedDocuments).where(eq(appliedDocuments.tenantId, clinic.tenantId)))[0]!;
    const historicalDocument = await app.request(`/api/applied-documents/${document.id}`, { headers: standardHeaders });
    expect(historicalDocument.status).toBe(200);
    const historical = await historicalDocument.json() as { url: string; head: { contentHash: string; contentSize: number } };
    const historicalBytes = new Uint8Array(await (await fetch(historical.url)).arrayBuffer());
    expect(sha256(historicalBytes)).toBe(historical.head.contentHash);
    expect(historicalBytes.byteLength).toBe(historical.head.contentSize);

    // Free may replace its own model, but the imported content is a new draft
    // and must not inherit Standard-only settings from the replaced DOCX.
    const replacement = docxWithPatientPlaceholder(' - modelo substituído');
    const replacementHash = sha256(replacement);
    const replacementPresign = await app.request(`/api/contracts/${model.id}/draft/presign`, {
      method: 'POST', headers: standardHeaders, body: JSON.stringify({}),
    });
    expect(replacementPresign.status).toBe(200);
    const replacementIntent = await replacementPresign.json() as { objectKey: string; uploadUrl: string };
    expect((await fetch(replacementIntent.uploadUrl, { method: 'PUT', headers: { 'content-type': DOCX }, body: replacement })).ok).toBe(true);
    const replacementSaved = await app.request(`/api/contracts/${model.id}/draft`, {
      method: 'PUT', headers: standardHeaders,
      body: JSON.stringify({ objectKey: replacementIntent.objectKey, contentType: DOCX, contentHash: replacementHash, size: replacement.byteLength }),
    });
    expect(replacementSaved.status).toBe(200);
    const replacedModel = (await getDatabase().select().from(contracts).where(eq(contracts.id, model.id)))[0]!;
    expect(replacedModel.draftDocxHash).toBe(replacementHash);
    expect(replacedModel.draftContextConfiguration).toBeNull();
    expect(replacedModel.draftAllowedPlaceholders).toBeNull();
    expect(replacedModel.draftRequiredPlaceholders).toBeNull();

    expect((await app.request(`/api/followup-contracts/${appliedId}/generate`, { method: 'POST', headers: standardHeaders, body: '{}' })).status).toBe(403);
    expect((await app.request(`/api/followup-contracts/${appliedId}/retry`, { method: 'POST', headers: standardHeaders, body: '{}' })).status).toBe(403);
    expect((await app.request(`/api/followup-contracts/${appliedId}/reprocess`, { method: 'POST', headers: standardHeaders, body: '{}' })).status).toBe(403);
    expect((await app.request(`/api/followup-contracts/${appliedId}/documents/presign`, {
      method: 'POST', headers: standardHeaders, body: JSON.stringify({ contentType: DOCX, contentHash: sourceHash, size: source.byteLength }),
    })).status).toBe(403);
    expect((await app.request(`/api/followup-contracts/${appliedId}/documents`, {
      method: 'POST', headers: standardHeaders, body: '{}',
    })).status).toBe(403);
    expect((await app.request(`/api/followup-contracts/${appliedId}/documents`, { headers: standardHeaders })).status).toBe(200);
    expect((await app.request(`/api/contracts/${model.id}/draft/editor`, { headers: standardHeaders })).status).toBe(200);
    expect((await app.request('/api/contracts', { headers: standardHeaders })).status).toBe(200);
  }, 120_000);
});
