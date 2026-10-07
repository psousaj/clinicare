import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import PizZip from 'pizzip';
import { app } from './app';
import {
  appliedDocuments, authUsers, buildPatientAad, closeDatabase, documentCleanupJobs, encryptValue, getDatabase, migrateDatabase,
  patients, procedures, plans, planVersions, planVersionItems, planVersionContracts,
  contracts, contractVersions, followupContracts, followups, followupItems, followupSnapshots,
  professionals, signatureEvents, signatureParticipants, signatureProcesses, signatureTokens,
} from '@clinicare/db';
import { deleteAppliedDocument } from './clinical';
import { assertSafeIntegrationDatabase, cleanupIntegrationClinics, integration, provisionIntegrationClinic, type IntegrationClinic } from './integration-support';
import { uploadObjectBytes } from './storage';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// Duas conversões reais com soffice (R0 inicial + R0 reprocessado).
const conversionIt = (name: string, test: () => Promise<void>) => it(name, test, 120_000);

function docxWithPatientName() {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">Paciente: {patient.name}</w:t></w:r></w:p></w:body></w:document>');
  return zip.generate({ type: 'uint8array' });
}

const contexts = {
  patient: { enabled: true, required: true },
  professional: { enabled: false, required: false },
  clinic: { enabled: false, required: false },
  application: { enabled: false, required: false },
  plan: { enabled: false, required: false },
};

integration('PostgreSQL reprocessamento manual do R0', () => {
  let tenantId: string;
  let clinic: IntegrationClinic;
  let headers: Record<string, string>;
  const post = (path: string, body: unknown) => app.request(path, { method: 'POST', headers, body: JSON.stringify(body) });

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    await migrateDatabase();
    tenantId = crypto.randomUUID();
    clinic = await provisionIntegrationClinic(app, 'reprocess', tenantId);
    headers = clinic.headers();
    const db = getDatabase();
    const [admin] = await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.email, clinic.email));
    await db.insert(professionals).values({ tenantId, userId: admin!.id, registrationType: 'CRM', registrationNumber: '123456', active: true });
  });

  afterAll(async () => {
    const db = getDatabase();
    const docs = await db.select({ id: appliedDocuments.id }).from(appliedDocuments).where(eq(appliedDocuments.tenantId, tenantId));
    for (const doc of docs) await deleteAppliedDocument(tenantId, doc.id).catch(() => null);
    for (const table of [documentCleanupJobs, signatureEvents, signatureTokens, signatureParticipants, signatureProcesses, followupContracts, followupSnapshots, followupItems, followups, planVersionContracts, planVersionItems, planVersions, plans, professionals, contractVersions, contracts, procedures, patients]) {
      await db.delete(table).where(eq((table as any).tenantId, tenantId));
    }
    await cleanupIntegrationClinics([tenantId]);
    await closeDatabase();
  });

  conversionIt('reprocessa o R0 com os dados atuais e congela após assinatura', async () => {
    const db = getDatabase();
    const patientId = crypto.randomUUID();
    const procedureId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const contractId = crypto.randomUUID();
    const phone = encryptValue('11987654321', buildPatientAad(tenantId, patientId, 'phone', 1));
    await db.insert(patients).values({ id: patientId, tenantId, fullName: 'Nome Original', phoneCiphertext: phone.ciphertext, phoneNonce: phone.nonce, phoneKeyVersion: 1 });
    await db.insert(procedures).values({ id: procedureId, tenantId, name: 'Procedimento reprocess', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(plans).values({ id: planId, tenantId, name: 'Plano reprocess' });
    await db.insert(planVersions).values({ id: versionId, tenantId, planId, version: 1, priceCents: 100 });
    await db.insert(planVersionItems).values({ tenantId, planVersionId: versionId, procedureId, sessions: 1, procedureName: 'Procedimento reprocess', durationMinutes: 30, priceCents: 100, sessionSchema: { type: 'object', properties: {} } });
    await db.insert(contracts).values({ id: contractId, tenantId, title: 'Contrato reprocess', kind: 'standard' });
    const docx = docxWithPatientName();
    const docxKey = crypto.randomUUID();
    await uploadObjectBytes(docxKey, docx, DOCX);
    await db.insert(contractVersions).values({
      tenantId, contractId, version: 1, sourceDocxObjectKey: docxKey, sourceDocxHash: sha256(docx), sourceDocxSize: docx.byteLength, sourceDocxContentType: DOCX,
      contextConfiguration: contexts, allowedPlaceholders: ['patient.name'], requiredPlaceholders: ['patient.name'], origin: 'created', content: null, sourceObjectKey: null,
    });
    await db.insert(planVersionContracts).values({ tenantId, planVersionId: versionId, contractId, title: 'Contrato reprocess' });

    const created = await (await post('/api/followups', { patientId, offerType: 'plan', offerId: planId })).json() as any;
    const appliedId = created.contracts[0].id as string;
    // A criação dispara a geração em background; aguarda o R0 em vez de
    // depender da forma da resposta do POST /generate (que varia se o
    // background já concluiu).
    let before: any = null;
    for (let attempt = 0; attempt < 90; attempt++) {
      before = (await db.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, appliedId))))[0]!;
      if (before.status === 'ready' || before.status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    expect(before.status).toBe('ready');
    expect(before.renderedPdfObjectKey).toBeTruthy();

    // Dado do paciente muda depois do R0: o reprocessamento usa o nome novo.
    await db.update(patients).set({ fullName: 'Nome Alterado' }).where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)));
    const response = await post(`/api/followup-contracts/${appliedId}/reprocess`, {});
    expect(response.status).toBe(200);
    const rows = await db.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.followupId, created.id)));
    const live = rows.find((row) => row.status === 'ready');
    expect(live).toBeTruthy();
    expect(live!.id).not.toBe(appliedId);
    const [oldRow] = await db.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, appliedId)));
    const [newRow] = await db.select().from(followupContracts).where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, live!.id)));
    expect(oldRow!.status).toBe('cancelled');
    expect(newRow!.renderedPdfHash).toBeTruthy();
    expect(newRow!.renderedPdfHash).not.toBe(before.renderedPdfHash);
    expect((await db.select().from(appliedDocuments).where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.followupContractId, appliedId))))).toHaveLength(1);

    // Após qualquer assinatura, o reprocessamento é bloqueado.
    const [process] = await db.select().from(signatureProcesses).where(and(eq(signatureProcesses.tenantId, tenantId), eq(signatureProcesses.followupContractId, live!.id)));
    await db.update(signatureParticipants).set({ status: 'signed', signedAt: new Date() }).where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.processId, process!.id)));
    expect((await post(`/api/followup-contracts/${live!.id}/reprocess`, {})).status).toBe(409);
  });
});
