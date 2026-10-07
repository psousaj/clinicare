import { Hono, type Context } from 'hono';
import { createHash } from 'node:crypto';
import { cors } from 'hono/cors';
import { getDatabasePool } from '@clinicare/db';
import { getTrustedOrigins } from './auth-config';
import { createPatient, deactivatePatient, getPatient, isUuid, listPatients, updatePatient } from './patients';
import { catalogTenant, listProcedures, createProcedure, updateProcedure, listAnamneses, createAnamnesis, updateAnamnesis, addAnamnesisVersion, associateAnamnesis, saveProcedureAnamneses, listCombos, saveCombo, listContracts, saveContract, addContractVersion, listPlans, savePlan, listEvents, saveEvent, presignContractVersionPdf, finalizeContractVersionPdf } from './catalog';
import { getRelationalRelationship } from './relational-relationship';
import { getRelationalHistory } from './relational-history';
import { createFollowup, getFollowup, listFollowups, cancelFollowup, updateFollowupState } from './followups';
import { cancelExternalAttempt, cancelExternalAttemptAsClinicRepresentative, confirmExternalReturn, confirmExternalReturnAsClinicRepresentative, downloadExternalExport, downloadExternalExportAsClinicRepresentative, exportExternalRevision, exportExternalRevisionAsClinicRepresentative, getSignatureHistory, importExternalReturn, importExternalReturnAsClinicRepresentative, listPendingSignatures, previewSignature, previewSignatureAsClinicRepresentative, readSignatureHistoryByToken, readSignaturePdf, readSignaturePdfForParticipant, readSignatureRevisionPdf, readSignatureToken, refreshSignatureToken, signAsClinicRepresentative, signWithToken, verifySignaturePhone } from './signatures';
import { addAttendancePhoto, cancelAttendance, confirmAppointment, createAppointment, createAttendance, deleteAppointment, getAttendance, listAppointments, listAttendances, presignAttendancePhoto, removeAttendancePhoto, updateAppointment, updateAttendance } from './scheduling';
import { createPayment, deletePayment, listPayments } from './payments';
import { deleteObject } from './storage';
import { addAnamnesisNote, answerAppliedAnamnesis, createAnamnesisRequest, createAppliedAnamnesis, deleteAppliedDocument, getAppliedDocument, listAnamnesisNotes, listAppliedDocuments, materializeAppliedDocumentResult, presignAppliedDocument, readAppliedAnamnesis, readPublicAnamnesis, refreshAnamnesisRequest, retryDocumentCleanupJobs, saveAnamnesisDraft, submitPublicAnamnesis } from './clinical';
import { authHandler, clinicSession, requireClinicSession } from './auth-routes';
import { getAccount, getProfessionalProfile, updateInitialPasswordChoice, updateProfessionalProfile } from './account-routes';
import { getContractDraftEditor, listContractPlaceholders, presignContractDraft, publishContractDraft, saveContractDraft } from './contract-authoring';
import { generateFollowupContract, retryFollowupContract } from './contract-generation';

const fail = (c: Context, message: string, status: 400 | 401 | 403 | 404 | 409 | 410 | 429 | 503 = 400) => c.json({ error: message }, status);
const isRecord = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const expiry = (days: number) => new Date(Date.now() + days * 86400000);
const observedClientIp = (c: Context) => process.env.TRUSTED_PROXY === 'true'
  ? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('cf-connecting-ip') ?? undefined
  : undefined;
const handleError = (c: Context, error: unknown) => {
  const explicitStatus = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : undefined;
  if (explicitStatus && [400, 401, 403, 404, 409, 410, 429, 503].includes(explicitStatus) && error instanceof Error) {
    const details = error as Error & { code?: string; currentRevisionId?: string; currentVersion?: number };
    return c.json({ error: error.message, ...(details.code ? { code: details.code } : {}), ...(details.currentRevisionId ? { currentRevisionId: details.currentRevisionId } : {}), ...(details.currentVersion !== undefined ? { currentVersion: details.currentVersion } : {}) }, explicitStatus as 400 | 401 | 403 | 404 | 409 | 410 | 429 | 503);
  }
  const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code: string | number }).code : undefined;
  const causeCode = error instanceof Error && error.cause && typeof error.cause === 'object' && 'code' in error.cause ? (error.cause as { code: string | number }).code : undefined;
  if ([errorCode, causeCode].includes('23505')) return c.json({ error: 'Este registro já existe.' }, 409);
  if ([errorCode, causeCode].includes('23503') || [errorCode, causeCode].includes('23514') || [errorCode, causeCode].includes('22P02')) return c.json({ error: 'Dados inválidos ou referência não encontrada.' }, 400);
  if (error instanceof Error && error.message === 'Tenant não encontrado.') return c.json({ error: error.message }, 400);
  if (error instanceof Error && /^(Nome completo é obrigatório\.|Data de nascimento inválida\.|E-mail inválido\.|Telefone inválido\.|CPF deve conter exatamente 11 dígitos\.|Notas inválidas\.)$/.test(error.message)) return c.json({ error: error.message }, 400);
  if (error instanceof Error && /^(Informe|Escolha|Tipo de contrato|Dados ou|Combo requer|Combo não|Combo sem|Anamnese |Combo do evento|Procedimento do evento|Procedimento já|Procedimento requer|A quantidade de sessões|Plano |Evento |Procedimento não|Contrato não|Versão não|Formulário inválido|Motivo do cancelamento|O acompanhamento|O PDF|Intenção de upload|Contrato aplicado|O caminho legado)/i.test(error.message)) return c.json({ error: error.message }, 400);
  if (error instanceof Error && /conflito|versão desatualizada/i.test(error.message)) return c.json({ error: error.message }, 409);
  if (error instanceof Error && /^(DATA_ENCRYPTION_KEY|SEARCH_HMAC_KEY|UPLOAD_SIGNING_KEY)/.test(error.message)) return c.json({ error: error.message }, 503);
  if (error instanceof Error && /R2 is not configured/i.test(error.message)) return c.json({ error: 'R2 não configurado.' }, 503);
  // Unexpected errors may wrap driver failures whose enumerable properties
  // carry request-derived values (fingerprint attributes, evidence payloads
  // in query params). Fingerprints are personal data linked to a participant,
  // so log only a sanitized summary — never the raw error object.
  const sanitized = error instanceof Error
    ? { name: error.name, message: error.message, ...('code' in error ? { code: String((error as { code: unknown }).code) } : {}) }
    : { message: 'unknown' };
  console.error(JSON.stringify({ route: c.req.path, method: c.req.method, ...sanitized }));
  return c.json({ error: 'Ocorreu um erro inesperado.' }, 500);
};

const appointmentStatusLabel: Record<string, string> = { planned: 'agendado', confirmed: 'confirmado', rescheduled: 'remarcado', cancelled: 'cancelado', no_show: 'faltou' };
const authTenant = (c: Context) => clinicSession(c).tenantId;
export const app = new Hono()
  .use('/api/*', cors({ origin: getTrustedOrigins() }))
  .onError((error, c) => handleError(c, error))
  // Rotas específicas ANTES do curinga do better-auth: o Hono executa o
  // primeiro handler que responde, então o '/api/auth/*' sombrearia o GET/POST
  // abaixo com 404 se viesse primeiro.
  .post('/api/auth/initial-password-choice', requireClinicSession, updateInitialPasswordChoice)
  .get('/api/auth/me', requireClinicSession, getAccount)
  .get('/api/auth/professional-profile', requireClinicSession, getProfessionalProfile)
  .put('/api/auth/professional-profile', requireClinicSession, updateProfessionalProfile)
  .on(['POST', 'GET'], '/api/auth/*', (c) => authHandler(c.req.raw))
  .get('/api/health', async (c) => {
    try { await getDatabasePool().query('select 1'); return c.json({ status: 'ok', service: 'clinicare-api', database: 'connected' }); }
    catch { return c.json({ status: 'unavailable', service: 'clinicare-api', database: 'disconnected' }, 503); }
  })
  .use('/api/patients/:id/history', async (c, next) => {
    if (!isUuid(c.req.param('id'))) return fail(c, 'Paciente não encontrado.', 404);
    await next();
  })
  .use('/api/patients*', requireClinicSession)
  .use('/api/procedures*', requireClinicSession)
  .use('/api/anamneses*', requireClinicSession)
  .use('/api/combos*', requireClinicSession)
  .use('/api/contracts*', requireClinicSession)
  .use('/api/plans*', requireClinicSession)
  .use('/api/events*', requireClinicSession)
  .use('/api/followups*', requireClinicSession)
  .use('/api/signature-pending', requireClinicSession)
  .use('/api/signature-history', requireClinicSession)
  .use('/api/signature-participants*', requireClinicSession)
  .use('/api/payments*', requireClinicSession)
  .use('/api/appointments*', requireClinicSession)
  .use('/api/attendances*', requireClinicSession)
  .use('/api/uploads*', requireClinicSession)
  .use('/api/patient-anamneses*', requireClinicSession)
  .use('/api/anamnesis-requests*', requireClinicSession)
  .use('/api/anamnesis-responses*', requireClinicSession)
  .use('/api/followup-contracts*', requireClinicSession)
  .use('/api/applied-documents*', requireClinicSession)
  .get('/api/patients', async (c) => {
    const tenantId = authTenant(c);
    return c.json(await listPatients(tenantId, c.req.query('query') ?? c.req.query('q'), clinicSession(c).userId));
  })
  .get('/api/patients/:id', async (c) => {
    const tenantId = authTenant(c);
    const patient = await getPatient(tenantId, c.req.param('id'), clinicSession(c).userId);
    return patient ? c.json(patient) : fail(c, 'Paciente não encontrado.', 404);
  })
  .post('/api/patients', async (c) => {
    const tenantId = authTenant(c);
    const body = await c.req.json().catch(() => null);
    if (!body) return fail(c, 'Dados do paciente inválidos.');
    return c.json(await createPatient(tenantId, body, clinicSession(c).userId), 201);
  })
  .put('/api/patients/:id', async (c) => {
    const tenantId = authTenant(c);
    const body = await c.req.json().catch(() => null);
    if (!body) return fail(c, 'Dados do paciente inválidos.');
    const patient = await updatePatient(tenantId, c.req.param('id'), body, clinicSession(c).userId);
    return patient ? c.json(patient) : fail(c, 'Paciente não encontrado.', 404);
  })
  .delete('/api/patients/:id', async (c) => {
    const tenantId = authTenant(c);
    const patient = await deactivatePatient(tenantId, c.req.param('id'), clinicSession(c).userId);
    if (patient && 'conflict' in patient) return fail(c, patient.conflict, 409);
    return patient ? c.json(patient) : fail(c, 'Paciente não encontrado.', 404);
  })
  .get('/api/procedures', async (c) => c.json(await listProcedures(await catalogTenant(c.req, authTenant(c)))))
  .post('/api/procedures', async (c) => { const body = await c.req.json().catch(() => null); if (!body || typeof body.name !== 'string' || body.name.trim().length < 2 || !Number.isInteger(body.durationMinutes) || body.durationMinutes < 1 || !Number.isSafeInteger(body.priceCents ?? 0) || body.priceCents < 0) return fail(c, 'Dados ou formulário de procedimento inválidos.'); return c.json(await createProcedure(await catalogTenant(c.req, authTenant(c)), body), 201); })
  .put('/api/procedures/:id/anamneses', async (c) => { try { if (!isUuid(c.req.param('id'))) return fail(c, 'Procedimento não encontrado.', 404); const result = await saveProcedureAnamneses(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), (await c.req.json().catch(() => ({})))?.anamnesisIds); return result ? c.json(result) : fail(c, 'Procedimento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .put('/api/procedures/:id', async (c) => { const body = await c.req.json().catch(() => null); if (!isRecord(body) || !isUuid(c.req.param('id'))) return fail(c, 'Dados de procedimento inválidos.'); const result = await updateProcedure(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), body); return result ? c.json(result) : fail(c, 'Procedimento não encontrado.', 404); })
  .get('/api/anamneses', async (c) => c.json(await listAnamneses(await catalogTenant(c.req, authTenant(c)))))
  .post('/api/anamneses', async (c) => c.json(await createAnamnesis(await catalogTenant(c.req, authTenant(c)), await c.req.json()), 201))
  .patch('/api/anamneses/:id', async (c) => { const result = await updateAnamnesis(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Formulário de anamnese não encontrado.', 404); })
  .post('/api/anamneses/:id/versions', async (c) => { const result = await addAnamnesisVersion(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json()); return result ? c.json(result, 201) : fail(c, 'Formulário de anamnese não encontrado.', 404); })
  .put('/api/anamneses/:id/associations', async (c) => { const body = await c.req.json(); const result = await associateAnamnesis(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), body?.procedures ?? []); return result ? c.json(result) : fail(c, 'Anamnese não encontrada.', 404); })
  .get('/api/combos', async (c) => c.json(await listCombos(await catalogTenant(c.req, authTenant(c)))))
  .post('/api/combos', async (c) => c.json(await saveCombo(await catalogTenant(c.req, authTenant(c)), null, await c.req.json()), 201))
  .put('/api/combos/:id', async (c) => { const result = await saveCombo(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Combo não encontrado.', 404); })
  .get('/api/contracts', async (c) => c.json(await listContracts(await catalogTenant(c.req, authTenant(c)))))
  .post('/api/contracts', async (c) => c.json(await saveContract(await catalogTenant(c.req, authTenant(c)), null, await c.req.json()), 201))
  .patch('/api/contracts/:id', async (c) => { const result = await saveContract(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Contrato não encontrado.', 404); })
  .post('/api/contracts/:id/versions', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await addContractVersion(tenantId, c.req.param('id'), await c.req.json()); return fail(c, 'Contrato não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .post('/api/contracts/:id/versions/rendered-pdf/presign', async (c) => { try { const body = await c.req.json().catch(() => ({})); return c.json(await presignContractVersionPdf(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), body.contentType, body.contentHash, body.size), 201); } catch (error) { return handleError(c, error); } })
  .post('/api/contracts/:id/versions/rendered-pdf', async (c) => { try { return c.json(await finalizeContractVersionPdf(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json().catch(() => ({}))), 201); } catch (error) { return handleError(c, error); } })
  .get('/api/contracts/placeholders', async (c) => c.json(await listContractPlaceholders()))
  .post('/api/contracts/:id/draft/presign', async (c) => { try { return c.json(await presignContractDraft(await catalogTenant(c.req, authTenant(c)), c.req.param('id'))); } catch (error) { return handleError(c, error); } })
  .get('/api/contracts/:id/draft/editor', async (c) => { try { const result = await getContractDraftEditor(await catalogTenant(c.req, authTenant(c)), c.req.param('id')); return result ? c.json(result) : fail(c, 'Contrato não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .put('/api/contracts/:id/draft', async (c) => { try { return c.json(await saveContractDraft(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json())); } catch (error) { return handleError(c, error); } })
  .post('/api/contracts/:id/publish', async (c) => { try { return c.json(await publishContractDraft(await catalogTenant(c.req, authTenant(c)), c.req.param('id')), 201); } catch (error) { return handleError(c, error); } })
  .get('/api/plans', async (c) => c.json(await listPlans(await catalogTenant(c.req, authTenant(c)))))
  .post('/api/plans', async (c) => c.json(await savePlan(await catalogTenant(c.req, authTenant(c)), null, await c.req.json()), 201))
  .put('/api/plans/:id', async (c) => { const result = await savePlan(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Plano não encontrado.', 404); })
  .get('/api/events', async (c) => c.json(await listEvents(await catalogTenant(c.req, authTenant(c)))))
  .post('/api/events', async (c) => c.json(await saveEvent(await catalogTenant(c.req, authTenant(c)), null, await c.req.json()), 201))
  .put('/api/events/:id', async (c) => { const result = await saveEvent(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Evento não encontrado.', 404); })
  .post('/api/followups', async (c) => {
    const tenantId = await catalogTenant(c.req, authTenant(c));
    const body = await c.req.json().catch(() => null);
    if (!body || !isUuid(body.patientId) || !['combo', 'plan', 'event'].includes(body.offerType) || !isUuid(body.offerId)) return fail(c, 'Paciente e um combo, plano ou evento são obrigatórios; procedimento avulso é criado ao agendar ou registrar o atendimento.');
    try {
      const created = await createFollowup(tenantId, body.patientId, body.offerType, body.offerId, { contractApplicationDate: body.contractApplicationDate, choice: body.choice });
      // Sem cron/worker: dispara a materialização em background sem bloquear o
      // 201. Falha de geração não desfaz o acompanhamento — fica como
      // generating/failed p/ retry no card (com polling até concluir).
      const professionalUserId = clinicSession(c).userId;
      const pending = (created?.contracts ?? []).filter((contract: any) => contract.status === 'generating' && contract.id).map((contract: any) => contract.id as string);
      if (pending.length) {
        void (async () => {
          for (const followupContractId of pending) {
            try { await generateFollowupContract(tenantId, followupContractId, professionalUserId); }
            catch { /* mantém generating/failed com generationError p/ retry manual */ }
          }
        })().catch(() => undefined);
      }
      return c.json(created, 201);
    } catch (error) { return handleError(c, error); }
  })
  .get('/api/followups', async (c) => {
    return c.json(await listFollowups(await catalogTenant(c.req, authTenant(c))));
  })
  .get('/api/followups/:id', async (c) => {
    const tenantId = await catalogTenant(c.req, authTenant(c));
    if (!isUuid(c.req.param('id'))) return fail(c, 'Acompanhamento inválido.');
    const result = await getFollowup(tenantId, c.req.param('id'));
    return result ? c.json(result) : fail(c, 'Acompanhamento não encontrado.', 404);
  })
  .post('/api/followup-contracts/:id/generate', async (c) => { try { return c.json(await generateFollowupContract(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), clinicSession(c).userId)); } catch (error) { return handleError(c, error); } })
  .post('/api/followup-contracts/:id/retry', async (c) => { try { return c.json(await retryFollowupContract(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), clinicSession(c).userId)); } catch (error) { return handleError(c, error); } })
  .get('/api/signature-pending', async (c) => { try { return c.json(await listPendingSignatures(await catalogTenant(c.req, authTenant(c)))); } catch (error) { return handleError(c, error); } })
  .get('/public/signatures/:token', async (c) => { try { return c.json(await readSignatureToken(c.req.param('token')!)); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/verify-phone', async (c) => { try { const body = await c.req.json().catch(() => ({})); return c.json(await verifySignaturePhone(c.req.param('token')!, body.phoneLast4)); } catch (error) { return handleError(c, error); } })
  .get('/public/signatures/:token/pdf', async (c) => { try { const bytes = await readSignaturePdf(c.req.param('token')!); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/preview', async (c) => { try { const body = await c.req.json().catch(() => ({})); const bytes = await previewSignature(c.req.param('token')!, body); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store', etag: createHash('sha256').update(bytes).digest('hex') } }); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/preview', requireClinicSession, async (c) => { try { const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); const bytes = await previewSignatureAsClinicRepresentative(c.req.param('id')!, body, actor); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store', etag: createHash('sha256').update(bytes).digest('hex') } }); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/confirm', async (c) => { try { const body = await c.req.json().catch(() => ({})); return c.json(await signWithToken(c.req.param('token')!, body.evidence, undefined, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/external/export', async (c) => { try { const body = await c.req.json().catch(() => ({})); return c.json(await exportExternalRevision(c.req.param('token')!, body, undefined, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .get('/public/signatures/:token/external/:attemptId/file', async (c) => { try { const bytes = await downloadExternalExport(c.req.param('token')!, c.req.param('attemptId')!); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="contrato-govbr.pdf"`, 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/external/import', async (c) => { try { const body = await c.req.json().catch(() => ({})); return c.json(await importExternalReturn(c.req.param('token')!, body, undefined, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/external/confirm', async (c) => { try { const body = await c.req.json().catch(() => ({})); return c.json(await confirmExternalReturn(c.req.param('token')!, body, undefined, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/external/cancel', async (c) => { try { const body = await c.req.json().catch(() => ({})); return c.json(await cancelExternalAttempt(c.req.param('token')!, body.attemptId)); } catch (error) { return handleError(c, error); } })
  .get('/public/signatures/:token/history', async (c) => { try { return c.json(await readSignatureHistoryByToken(c.req.param('token')!)); } catch (error) { return handleError(c, error); } })
  .get('/public/signatures/:token/revisions/:revisionId/pdf', async (c) => { try { const bytes = await readSignatureRevisionPdf(c.req.param('token')!, c.req.param('revisionId')!); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .get('/api/signature-history', async (c) => { try { const contractId = c.req.query('followupContractId') ?? ''; return c.json(await getSignatureHistory(await catalogTenant(c.req, authTenant(c)), contractId, { kind: 'panel' })); } catch (error) { return handleError(c, error); } })
  .get('/api/signature-participants/:id/revisions/:revisionId/pdf', requireClinicSession, async (c) => { try { const bytes = await readSignatureRevisionPdf(`participant:${c.req.param('id')!}`, c.req.param('revisionId')!, clinicSession(c)); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/external/export', requireClinicSession, async (c) => { try { const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); return c.json(await exportExternalRevisionAsClinicRepresentative(c.req.param('id')!, body, actor, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .get('/api/signature-participants/:id/external/:attemptId/file', requireClinicSession, async (c) => { try { const bytes = await downloadExternalExportAsClinicRepresentative(c.req.param('id')!, c.req.param('attemptId')!, clinicSession(c)); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="contrato-govbr.pdf"`, 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/external/import', requireClinicSession, async (c) => { try { const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); return c.json(await importExternalReturnAsClinicRepresentative(c.req.param('id')!, body, actor, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/external/confirm', requireClinicSession, async (c) => { try { const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); return c.json(await confirmExternalReturnAsClinicRepresentative(c.req.param('id')!, body, actor, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/external/cancel', requireClinicSession, async (c) => { try { const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); return c.json(await cancelExternalAttemptAsClinicRepresentative(c.req.param('id')!, body.attemptId, actor)); } catch (error) { return handleError(c, error); } })
  .get('/api/signature-participants/:id/pdf', requireClinicSession, async (c) => { try { const bytes = await readSignaturePdfForParticipant(c.req.param('id')!, clinicSession(c)); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/confirm', requireClinicSession, async (c) => { try { const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); return c.json(await signAsClinicRepresentative(c.req.param('id')!, body.evidence, actor, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/refresh', async (c) => { if (!isUuid(c.req.param('id'))) return fail(c, 'Participante inválido.'); try { return c.json(await refreshSignatureToken(await catalogTenant(c.req, authTenant(c)), c.req.param('id'))); } catch (error) { return handleError(c, error); } })
  .post('/api/followups/:id/cancel', async (c) => {
    const tenantId = await catalogTenant(c.req, authTenant(c));
    if (!isUuid(c.req.param('id'))) return fail(c, 'Acompanhamento inválido.');
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body) || typeof body.reason !== 'string' || !body.reason.trim()) return fail(c, 'Motivo do cancelamento é obrigatório.');
    try { const result = await cancelFollowup(tenantId, c.req.param('id'), body.reason); return result ? c.json(result) : fail(c, 'Acompanhamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .patch('/api/followups/:id/state', async (c) => {
    const tenantId = await catalogTenant(c.req, authTenant(c));
    if (!isUuid(c.req.param('id'))) return fail(c, 'Acompanhamento inválido.');
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body) || !['completed', 'cancelled'].includes(body.status)) return fail(c, 'Estado de acompanhamento inválido.');
    try { const result = await updateFollowupState(tenantId, c.req.param('id'), body.status, body.reason); return result ? c.json(result) : fail(c, 'Acompanhamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .post('/api/payments', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body) || !isUuid(body.followupId) || !Number.isSafeInteger(body.amountCents) || body.amountCents <= 0 || !['cash', 'pix', 'credit_card'].includes(body.method)) return fail(c, 'Pagamento inválido.');
    try {
      const tenantId = await catalogTenant(c.req, authTenant(c));
      return c.json(await createPayment(tenantId, { followupId: body.followupId, amountCents: body.amountCents, method: body.method, installments: body.installments, notes: body.notes, receivedAt: body.receivedAt, idempotencyKey: body.idempotencyKey ?? c.req.header('idempotency-key') }), 201);
    } catch (error) { return handleError(c, error); }
  })
  .delete('/api/payments/:id', async (c) => {
    try {
      const result = await deletePayment(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), String((await c.req.json().catch(() => ({}))).reason ?? ''));
      return result ? c.json(result) : fail(c, 'Pagamento não encontrado.', 404);
    } catch (error) { return handleError(c, error); }
  })
  .get('/api/followups/:id/payments', async (c) => {
    try {
      const tenantId = await catalogTenant(c.req, authTenant(c));
      if (!isUuid(c.req.param('id'))) return fail(c, 'Acompanhamento inválido.');
      return c.json(await listPayments(tenantId, c.req.param('id')));
    } catch (error) { return handleError(c, error); }
  })
  .get('/api/appointments', async (c) => {
    try { const tenantId = await catalogTenant(c.req, authTenant(c)); const from = c.req.query('from') ? new Date(c.req.query('from')!) : new Date(Date.now() - 7 * 86400000), to = c.req.query('to') ? new Date(c.req.query('to')!) : expiry(14); return c.json(await listAppointments(tenantId, from, to)); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments', async (c) => {
    try { return c.json(await createAppointment(await catalogTenant(c.req, authTenant(c)), await c.req.json().catch(() => null)), 201); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/confirm', async (c) => {
    try { const body = await c.req.json().catch(() => ({})); return c.json(await confirmAppointment(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), Array.isArray(body?.selectedItemIds) ? body.selectedItemIds : undefined)); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/no-show', async (c) => {
    try { const body = await c.req.json().catch(() => ({})); const result = await updateAppointment(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), { status: 'no_show', reason: body.reason }); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/cancel', async (c) => {
    try { const result = await updateAppointment(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), { status: 'cancelled' }); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/attendance', async (c) => {
    try { return c.json(await createAttendance(await catalogTenant(c.req, authTenant(c)), { ...(await c.req.json().catch(() => ({}))), appointmentId: c.req.param('id') }), 201); } catch (error) { return handleError(c, error); }
  })
  .patch('/api/appointments/:id', async (c) => { try { const result = await updateAppointment(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json().catch(() => ({}))); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .delete('/api/appointments/:id', async (c) => { try { const result = await deleteAppointment(await catalogTenant(c.req, authTenant(c)), c.req.param('id')); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .get('/api/attendances', async (c) => { try { return c.json(await listAttendances(await catalogTenant(c.req, authTenant(c)))); } catch (error) { return handleError(c, error); } })
  .get('/api/attendances/:id', async (c) => { try { const result = await getAttendance(await catalogTenant(c.req, authTenant(c)), c.req.param('id')); return result ? c.json(result) : fail(c, 'Atendimento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .post('/api/attendances', async (c) => { try { return c.json(await createAttendance(await catalogTenant(c.req, authTenant(c)), await c.req.json().catch(() => ({}))), 201); } catch (error) { return handleError(c, error); } })
  .patch('/api/attendances/:id', async (c) => { try { const result = await updateAttendance(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json().catch(() => ({}))); return result ? c.json(result) : fail(c, 'Atendimento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .patch('/api/attendances/:id/cancel', async (c) => { try { const body = await c.req.json().catch(() => ({})); return c.json(await cancelAttendance(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), String(body.reason ?? ''))); } catch (error) { return handleError(c, error); } })
  .post('/api/uploads/presign', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.contentType !== 'string' || !/^image\/(jpeg|png|webp)$/.test(body.contentType) || !Number.isInteger(body.size) || body.size < 1 || body.size > 10_000_000 || !isUuid(body.attendanceId)) return fail(c, 'Imagem ou atendimento inválido.');
    try { const result = await presignAttendancePhoto(await catalogTenant(c.req, authTenant(c)), body.attendanceId, body.contentType, typeof body.contentHash === 'string' ? body.contentHash : null); return c.json(result); }
    catch (error) { return handleError(c, error); }
  })
  .post('/api/attendances/:id/photos', async (c) => {
    try { return c.json(await addAttendancePhoto(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json().catch(() => null)), 201); } catch (error) { return handleError(c, error); }
  })
  .delete('/api/attendances/:id/photos/:photoId', async (c) => {
    try {
      const result = await removeAttendancePhoto(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), c.req.param('photoId'));
      try { await deleteObject(result.objectKey); } catch (error) { console.error(error); }
      return c.json({ deleted: true });
    } catch (error) { return handleError(c, error); }
  })
  .post('/api/patient-anamneses', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); const body = await c.req.json(); if (!isUuid(body?.patientId) || !isUuid(body?.anamnesisId) || !isUuid(body?.followupId)) return fail(c, 'Paciente, acompanhamento e anamnese são obrigatórios.'); return c.json(await createAppliedAnamnesis(tenantId, body), 201); } catch (error) { return handleError(c, error); } })
  .post('/api/anamnesis-requests', async (c) => { try { const body = await c.req.json(); if (!isUuid(body?.patientAnamnesisId)) return fail(c, 'Anamnese aplicada inválida.'); return c.json(await createAnamnesisRequest(await catalogTenant(c.req, authTenant(c)), body.patientAnamnesisId), 201); } catch (error) { return handleError(c, error); } })
  .put('/api/anamnesis-requests/:id/refresh', async (c) => { try { return c.json(await refreshAnamnesisRequest(await catalogTenant(c.req, authTenant(c)), c.req.param('id'))); } catch (error) { return handleError(c, error); } })
  .get('/public/anamnesis/:token', async (c) => { const result = await readPublicAnamnesis(c.req.param('token')); return result ? c.json(result) : fail(c, 'Link inválido, expirado ou já enviado.', 404); })
  .put('/public/anamnesis/:token/draft', async (c) => { const body = await c.req.json().catch(() => null); if (!isRecord(body?.draft)) return fail(c, 'Rascunho inválido.'); return await saveAnamnesisDraft(c.req.param('token'), body.draft) ? c.json({ saved: true }) : fail(c, 'Link inválido ou expirado.', 404); })
  .post('/public/anamnesis/:token/submit', async (c) => { const body = await c.req.json().catch(() => null); if (!isRecord(body?.answers)) return fail(c, 'Respostas inválidas.'); const result = await submitPublicAnamnesis(c.req.param('token'), body.answers); return result ? c.json(result, 201) : fail(c, 'Link inválido, expirado ou já enviado.', 409); })
  .get('/api/patient-anamneses/:id', async (c) => { const result = await readAppliedAnamnesis(await catalogTenant(c.req, authTenant(c)), c.req.param('id')); return result ? c.json(result) : fail(c, 'Anamnese não encontrada.', 404); })
  .post('/api/patient-anamneses/:id/answers', async (c) => { const body = await c.req.json().catch(() => null); if (!isRecord(body?.answers)) return fail(c, 'Respostas inválidas.'); const result = await answerAppliedAnamnesis(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), body.answers); return result ? c.json({ submitted: true }, 201) : fail(c, 'Anamnese não encontrada ou já respondida.', 404); })
  .post('/api/anamnesis-responses/:id/notes', async (c) => { const body = await c.req.json().catch(() => null); const result = await addAnamnesisNote(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), body?.content ?? ''); return result ? c.json(result, 201) : fail(c, 'Resposta não encontrada ou ainda não enviada.', 404); })
  .get('/api/anamnesis-responses/:id/notes', async (c) => { const result = await listAnamnesisNotes(await catalogTenant(c.req, authTenant(c)), c.req.param('id')); return result ? c.json(result) : fail(c, 'Resposta não encontrada ou ainda não enviada.', 404); })
  .post('/api/followup-contracts/:id/documents/presign', async (c) => { try { const body = await c.req.json().catch(() => ({})); return c.json(await presignAppliedDocument(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), body.contentType, body.contentHash, body.size)); } catch (error) { return handleError(c, error); } })
  .post('/api/followup-contracts/:id/documents', async (c) => { try { const body = await c.req.json().catch(() => ({})); const result = await materializeAppliedDocumentResult(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), body); return c.json(result.document, result.existing ? 200 : 201); } catch (error) { return handleError(c, error); } })
   .get('/api/followup-contracts/:id/documents', async (c) => { const result = await listAppliedDocuments(await catalogTenant(c.req, authTenant(c)), c.req.param('id')); return result ? c.json(result) : fail(c, 'Contrato aplicado não encontrado.', 404); })
  .get('/api/applied-documents/:id', async (c) => { const result = await getAppliedDocument(await catalogTenant(c.req, authTenant(c)), c.req.param('id')); return result ? c.json(result) : fail(c, 'Documento não encontrado.', 404); })
  .delete('/api/applied-documents/:id', async (c) => { try { const result = await deleteAppliedDocument(await catalogTenant(c.req, authTenant(c)), c.req.param('id')); if (!result) return fail(c, 'Documento não encontrado.', 404); return c.json(result, result.cleanup.status === 'failed' ? 503 : 200); } catch (error) { return handleError(c, error); } })
  .post('/api/applied-documents/cleanup', async (c) => { try { return c.json(await retryDocumentCleanupJobs(await catalogTenant(c.req, authTenant(c)))); } catch (error) { return handleError(c, error); } })
  .get('/api/patients/:id/relationship', async (c) => {
    try {
      if (!isUuid(c.req.param('id'))) return fail(c, 'Paciente não encontrado.', 404);
      const tenantId = await catalogTenant(c.req, authTenant(c));
      const report = await getRelationalRelationship(tenantId, c.req.param('id'));
      return report ? c.json(report) : fail(c, 'Paciente não encontrado.', 404);
    } catch (error) { return handleError(c, error); }
  })
  .get('/api/patients/:id/history', async (c) => {
    try {
      if (!isUuid(c.req.param('id'))) return fail(c, 'Paciente não encontrado.', 404);
      const tenantId = await catalogTenant(c.req, authTenant(c));
       const history = await getRelationalHistory(tenantId, c.req.param('id'), clinicSession(c).userId);
      return history ? c.json(history) : fail(c, 'Paciente não encontrado.', 404);
    } catch (error) { return handleError(c, error); }
  });
