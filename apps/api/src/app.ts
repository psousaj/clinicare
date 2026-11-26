import { Hono, type Context } from 'hono';
import { createHash } from 'node:crypto';
import { cors } from 'hono/cors';
import { and, eq, gt, isNotNull, isNull } from 'drizzle-orm';
import { appliedAnamneses, appliedDocuments, appointmentItems, attendances, followupContracts, followups, getDatabase, getDatabasePool, payments, procedures, signatureParticipants, signatureProcesses, signatureTokens } from '@clinicare/db';
import { getTrustedOrigins } from './auth-config';
import { createPatient, deactivatePatient, getPatient, isUuid, listPatients, updatePatient } from './patients';
import { catalogTenant, listProcedures, createProcedure, updateProcedure, listAnamneses, createAnamnesis, updateAnamnesis, addAnamnesisVersion, saveProcedureAnamneses, listCombos, saveCombo, listContracts, saveContract, addContractVersion, listPlans, savePlan, listEvents, saveEvent, presignContractVersionPdf, finalizeContractVersionPdf } from './catalog';
import { getRelationalRelationship } from './relational-relationship';
import { getRelationalHistory } from './relational-history';
import { createFollowup, getFollowup, listFollowups, cancelFollowup, cancelFollowupItem, updateFollowupState } from './followups';
import { cancelExternalAttempt, cancelExternalAttemptAsClinicRepresentative, confirmExternalReturn, confirmExternalReturnAsClinicRepresentative, downloadExternalExport, downloadExternalExportAsClinicRepresentative, exportExternalRevision, exportExternalRevisionAsClinicRepresentative, getSignatureHistory, importExternalReturn, importExternalReturnAsClinicRepresentative, listPendingSignatures, previewSignature, previewSignatureAsClinicRepresentative, readSignatureHistoryByToken, readSignaturePdf, readSignaturePdfForParticipant, readSignatureRevisionPdf, readSignatureToken, refreshSignatureToken, signAsClinicRepresentative, signWithToken, verifySignaturePhone } from './signatures';
import { addAttendancePhoto, cancelAttendance, confirmAppointment, createAppointment, createAttendance, deleteAppointment, getAttendance, listAppointments, listAttendances, presignAttendancePhoto, removeAttendancePhoto, updateAppointment, updateAttendance } from './scheduling';
import { createPayment, deletePayment, listPayments } from './payments';
import { deleteObject } from './storage';
import { addAnamnesisNote, answerAppliedAnamnesis, createAnamnesisRequest, createAppliedAnamnesis, deleteAppliedDocument, getAppliedDocument, listAnamnesisNotes, listAppliedDocuments, materializeAppliedDocumentResult, presignAppliedDocument, readAppliedAnamnesis, readPublicAnamnesis, refreshAnamnesisRequest, retryDocumentCleanupJobs, saveAnamnesisDraft, submitPublicAnamnesis } from './clinical';
import { authHandler, clinicSession, requireClinicSession } from './auth-routes';
import { changeOwnEmail, changeOwnPassword, getAccount, getDefaultSignature, getProfessionalProfile, updateAccount, updateDefaultSignature, updateInitialPasswordChoice, updateProfessionalProfile } from './account-routes';
import { getContractDraftEditor, listContractPlaceholders, presignContractDraft, publishContractDraft, saveContractDraft, saveContractDraftConfiguration } from './contract-authoring';
import { generateFollowupContract, reprocessFollowupContract, retryFollowupContract } from './contract-generation';
import { observedClientIp as resolveObservedClientIp } from './request-ip';
import { clinicHasCapability, getSaasSubscription, listSaasPlans, requireClinicCapability } from './saas-plans';
import { createClinicForUser, getPersonalAccountState, type ClinicOnboardingInput } from './onboarding';

const fail = (c: Context, message: string, status: 400 | 401 | 403 | 404 | 409 | 410 | 429 | 503 = 400) => c.json({ error: message }, status);
const isRecord = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const expiry = (days: number) => new Date(Date.now() + days * 86400000);
const observedClientIp = (c: Context) => resolveObservedClientIp(c.req.raw);
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
const requireFollowupSessionCapability = async (tenantId: string, appointmentId: string) => {
  const linked = await getDatabase().select({ id: appointmentItems.id }).from(appointmentItems)
    .where(and(eq(appointmentItems.tenantId, tenantId), eq(appointmentItems.appointmentId, appointmentId), isNotNull(appointmentItems.followupItemId))).limit(1);
  if (linked.length) await requireClinicCapability(tenantId, 'appointments.followup_sessions');
};
const requireFollowupAttendanceCapability = async (tenantId: string, attendanceId: string) => {
  const linked = await getDatabase().select({ id: attendances.id }).from(attendances)
    .where(and(eq(attendances.tenantId, tenantId), eq(attendances.id, attendanceId), isNotNull(attendances.followupItemId))).limit(1);
  if (linked.length) await requireClinicCapability(tenantId, 'appointments.followup_sessions');
};
const requireOfferMutationCapability = async (tenantId: string, followupId: string) => {
  const [followup] = await getDatabase().select({ offerType: followups.offerType }).from(followups)
    .where(and(eq(followups.tenantId, tenantId), eq(followups.id, followupId)));
  if (followup?.offerType === 'combo') await requireClinicCapability(tenantId, 'catalog.combos');
  if (followup?.offerType === 'plan') await requireClinicCapability(tenantId, 'catalog.clinical_plans');
};
const requireAttendanceFollowupCapability = async (tenantId: string, attendanceId: string) => {
  const [attendance] = await getDatabase().select({ followupId: attendances.followupId }).from(attendances)
    .where(and(eq(attendances.tenantId, tenantId), eq(attendances.id, attendanceId)));
  if (attendance?.followupId) await requireOfferMutationCapability(tenantId, attendance.followupId);
};
const requireFollowupContractCapability = async (tenantId: string, contractId: string) => {
  const [contract] = await getDatabase().select({ followupId: followupContracts.followupId }).from(followupContracts)
    .where(and(eq(followupContracts.tenantId, tenantId), eq(followupContracts.id, contractId)));
  if (contract) await requireOfferMutationCapability(tenantId, contract.followupId);
};
const requireAppliedDocumentFollowupCapability = async (tenantId: string, documentId: string) => {
  const [document] = await getDatabase().select({ followupContractId: appliedDocuments.followupContractId })
    .from(appliedDocuments)
    .where(and(eq(appliedDocuments.tenantId, tenantId), eq(appliedDocuments.id, documentId)));
  if (document) await requireFollowupContractCapability(tenantId, document.followupContractId);
};
const requireAppliedAnamnesisFollowupCapability = async (tenantId: string, appliedId: string) => {
  const [applied] = await getDatabase().select({ followupId: appliedAnamneses.followupId })
    .from(appliedAnamneses)
    .where(and(eq(appliedAnamneses.tenantId, tenantId), eq(appliedAnamneses.id, appliedId)));
  if (applied?.followupId) await requireOfferMutationCapability(tenantId, applied.followupId);
};
const requirePublicAnamnesisCapability = async (token: string) => {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const [applied] = await getDatabase().select({ tenantId: appliedAnamneses.tenantId })
    .from(appliedAnamneses)
    .where(and(
      eq(appliedAnamneses.requestTokenHash, tokenHash),
      isNull(appliedAnamneses.submittedAt),
      gt(appliedAnamneses.requestExpiresAt, new Date()),
    ));
  if (applied) await requireClinicCapability(applied.tenantId, 'anamnesis.public_links');
};
const hasCustomAttendanceData = (data: unknown) =>
  isRecord(data) && Object.keys(data).length > 0;
const hasCustomSessionFields = (schema: unknown) =>
  isRecord(schema) && isRecord(schema.properties) && Object.keys(schema.properties).length > 0;
const requireSignatureParticipantFollowupCapability = async (tenantId: string, participantId: string) => {
  const [participant] = await getDatabase().select({ followupContractId: signatureProcesses.followupContractId })
    .from(signatureParticipants)
    .innerJoin(signatureProcesses, and(
      eq(signatureProcesses.tenantId, signatureParticipants.tenantId),
      eq(signatureProcesses.id, signatureParticipants.processId),
    ))
    .where(and(eq(signatureParticipants.tenantId, tenantId), eq(signatureParticipants.id, participantId)));
  if (participant) {
    await requireClinicCapability(tenantId, 'contracts.patient_signatures');
    await requireFollowupContractCapability(tenantId, participant.followupContractId);
  }
};
const requireSignatureTokenFollowupCapability = async (token: string) => {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const [signature] = await getDatabase().select({
    tenantId: signatureTokens.tenantId,
    followupContractId: signatureProcesses.followupContractId,
  }).from(signatureTokens)
    .innerJoin(signatureParticipants, and(
      eq(signatureParticipants.tenantId, signatureTokens.tenantId),
      eq(signatureParticipants.id, signatureTokens.participantId),
    ))
    .innerJoin(signatureProcesses, and(
      eq(signatureProcesses.tenantId, signatureParticipants.tenantId),
      eq(signatureProcesses.id, signatureParticipants.processId),
    ))
    .where(and(eq(signatureTokens.tokenHash, tokenHash), isNull(signatureTokens.revokedAt), gt(signatureTokens.expiresAt, new Date())));
  if (signature) {
    await requireClinicCapability(signature.tenantId, 'contracts.patient_signatures');
    await requireFollowupContractCapability(signature.tenantId, signature.followupContractId);
  }
};
const signatureTokenCanSign = async (token: string) => {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const [signature] = await getDatabase().select({ tenantId: signatureTokens.tenantId })
    .from(signatureTokens)
    .where(and(
      eq(signatureTokens.tokenHash, tokenHash),
      isNull(signatureTokens.revokedAt),
      gt(signatureTokens.expiresAt, new Date()),
    ));
  return signature ? clinicHasCapability(signature.tenantId, 'contracts.patient_signatures') : false;
};
export const app = new Hono()
  .use('/api/*', cors({ origin: getTrustedOrigins() }))
  .onError((error, c) => handleError(c, error))
  .get('/api/saas/plans', async (c) => c.json(await listSaasPlans()))
  .get('/api/saas/subscription', requireClinicSession, async (c) => c.json(await getSaasSubscription(authTenant(c))))
  .get('/api/account/state', async (c) => {
    const state = await getPersonalAccountState(c.req.raw);
    return state.kind === 'unauthenticated' ? c.json({ error: 'Autenticação necessária.' }, 401) : c.json(state);
  })
  .post('/api/clinics/onboarding', async (c) => {
    const state = await getPersonalAccountState(c.req.raw);
    if (state.kind === 'unauthenticated') return c.json({ error: 'Autenticação necessária.' }, 401);
    if (state.kind === 'confirmation') return c.json({ error: 'Confirme seu e-mail antes de cadastrar a clínica.' }, 403);
    if (state.kind === 'inactive' || state.kind === 'ambiguous') return c.json({ error: 'A conta não pode concluir onboarding neste estado.' }, 409);
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body)) return fail(c, 'Dados da clínica inválidos.');
    if ('id' in body || 'tenantId' in body || 'tenant_id' in body) return fail(c, 'Não é permitido informar uma clínica existente.');
    try {
      const result = await createClinicForUser(state.user.id, body as ClinicOnboardingInput);
      return c.json(result, result.recovered ? 200 : 201);
    } catch (error) { return handleError(c, error); }
  })
  // Rotas específicas ANTES do curinga do better-auth: o Hono executa o
  // primeiro handler que responde, então o '/api/auth/*' sombrearia o GET/POST
  // abaixo com 404 se viesse primeiro.
  .post('/api/auth/initial-password-choice', requireClinicSession, updateInitialPasswordChoice)
  .post('/api/auth/change-password', requireClinicSession, changeOwnPassword)
  .post('/api/auth/change-email', requireClinicSession, changeOwnEmail)
  .get('/api/auth/me', requireClinicSession, getAccount)
  .patch('/api/auth/me', requireClinicSession, updateAccount)
  .get('/api/auth/professional-profile', requireClinicSession, getProfessionalProfile)
  .put('/api/auth/professional-profile', requireClinicSession, updateProfessionalProfile)
  .get('/api/auth/default-signature', requireClinicSession, async (c) => { try { await requireClinicCapability(authTenant(c), 'contracts.patient_signatures'); return await getDefaultSignature(c); } catch (error) { return handleError(c, error); } })
  .put('/api/auth/default-signature', requireClinicSession, async (c) => { try { await requireClinicCapability(authTenant(c), 'contracts.patient_signatures'); return await updateDefaultSignature(c); } catch (error) { return handleError(c, error); } })
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
  .post('/api/procedures', async (c) => { const tenantId = await catalogTenant(c.req, authTenant(c)); const body = await c.req.json().catch(() => null); if (!body || typeof body.name !== 'string' || body.name.trim().length < 2 || !Number.isInteger(body.durationMinutes) || body.durationMinutes < 1 || !Number.isSafeInteger(body.priceCents ?? 0) || body.priceCents < 0) return fail(c, 'Dados ou formulário de procedimento inválidos.'); if (hasCustomSessionFields(body.sessionSchema)) await requireClinicCapability(tenantId, 'patient.custom_fields'); return c.json(await createProcedure(tenantId, body), 201); })
  .put('/api/procedures/:id/anamneses', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'anamnesis.in_clinic'); if (!isUuid(c.req.param('id'))) return fail(c, 'Procedimento não encontrado.', 404); const result = await saveProcedureAnamneses(tenantId, c.req.param('id'), (await c.req.json().catch(() => ({})))?.anamnesisIds); return result ? c.json(result) : fail(c, 'Procedimento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .put('/api/procedures/:id', async (c) => { const body = await c.req.json().catch(() => null); if (!isRecord(body) || !isUuid(c.req.param('id'))) return fail(c, 'Dados de procedimento inválidos.'); const tenantId = await catalogTenant(c.req, authTenant(c)); if (body.sessionSchema !== undefined) { const [current] = await getDatabase().select({ sessionSchema: procedures.sessionSchema }).from(procedures).where(and(eq(procedures.tenantId, tenantId), eq(procedures.id, c.req.param('id')))); const changedCustomSchema = current && JSON.stringify(body.sessionSchema) !== JSON.stringify(current.sessionSchema) && (hasCustomSessionFields(current.sessionSchema) || hasCustomSessionFields(body.sessionSchema)); if (changedCustomSchema) await requireClinicCapability(tenantId, 'patient.custom_fields'); } const result = await updateProcedure(tenantId, c.req.param('id'), body); return result ? c.json(result) : fail(c, 'Procedimento não encontrado.', 404); })
  .get('/api/anamneses', async (c) => c.json(await listAnamneses(await catalogTenant(c.req, authTenant(c)))))
  .post('/api/anamneses', async (c) => { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'anamnesis.in_clinic'); return c.json(await createAnamnesis(tenantId, await c.req.json()), 201); })
  .patch('/api/anamneses/:id', async (c) => { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'anamnesis.in_clinic'); const result = await updateAnamnesis(tenantId, c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Formulário de anamnese não encontrado.', 404); })
  .post('/api/anamneses/:id/versions', async (c) => { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'anamnesis.in_clinic'); const result = await addAnamnesisVersion(tenantId, c.req.param('id'), await c.req.json()); return result ? c.json(result, 201) : fail(c, 'Formulário de anamnese não encontrado.', 404); })
  .get('/api/combos', async (c) => c.json(await listCombos(await catalogTenant(c.req, authTenant(c)))))
  .post('/api/combos', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'catalog.combos'); return c.json(await saveCombo(tenantId, null, await c.req.json()), 201); } catch (error) { return handleError(c, error); } })
  .put('/api/combos/:id', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'catalog.combos'); const result = await saveCombo(tenantId, c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Combo não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .get('/api/contracts', async (c) => c.json(await listContracts(await catalogTenant(c.req, authTenant(c)))))
  .post('/api/contracts', async (c) => c.json(await saveContract(await catalogTenant(c.req, authTenant(c)), null, await c.req.json()), 201))
  .patch('/api/contracts/:id', async (c) => { const result = await saveContract(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Contrato não encontrado.', 404); })
  .post('/api/contracts/:id/versions', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.generation'); await addContractVersion(tenantId, c.req.param('id'), await c.req.json()); return fail(c, 'Contrato não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .post('/api/contracts/:id/versions/rendered-pdf/presign', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.generation'); const body = await c.req.json().catch(() => ({})); return c.json(await presignContractVersionPdf(tenantId, c.req.param('id'), body.contentType, body.contentHash, body.size), 201); } catch (error) { return handleError(c, error); } })
  .post('/api/contracts/:id/versions/rendered-pdf', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.generation'); return c.json(await finalizeContractVersionPdf(tenantId, c.req.param('id'), await c.req.json().catch(() => ({}))), 201); } catch (error) { return handleError(c, error); } })
  .get('/api/contracts/placeholders', async (c) => c.json(await listContractPlaceholders()))
  .post('/api/contracts/:id/draft/presign', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.docx_import'); return c.json(await presignContractDraft(tenantId, c.req.param('id'))); } catch (error) { return handleError(c, error); } })
  .get('/api/contracts/:id/draft/editor', async (c) => { try { const result = await getContractDraftEditor(await catalogTenant(c.req, authTenant(c)), c.req.param('id')); return result ? c.json(result) : fail(c, 'Contrato não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .put('/api/contracts/:id/draft', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.docx_import'); const canConfigure = await clinicHasCapability(tenantId, 'contracts.generation'); return c.json(await saveContractDraft(tenantId, c.req.param('id'), await c.req.json(), canConfigure)); } catch (error) { return handleError(c, error); } })
  .put('/api/contracts/:id/draft/configuration', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.generation'); return c.json(await saveContractDraftConfiguration(tenantId, c.req.param('id'), await c.req.json())); } catch (error) { return handleError(c, error); } })
  .post('/api/contracts/:id/publish', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.generation'); let professionalUserId: string | undefined; try { professionalUserId = clinicSession(c).userId; } catch { professionalUserId = undefined; } return c.json(await publishContractDraft(tenantId, c.req.param('id'), professionalUserId), 201); } catch (error) { return handleError(c, error); } })
  .get('/api/plans', async (c) => c.json(await listPlans(await catalogTenant(c.req, authTenant(c)))))
  .post('/api/plans', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'catalog.clinical_plans'); return c.json(await savePlan(tenantId, null, await c.req.json()), 201); } catch (error) { return handleError(c, error); } })
  .put('/api/plans/:id', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'catalog.clinical_plans'); const result = await savePlan(tenantId, c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Plano não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .get('/api/events', async (c) => c.json(await listEvents(await catalogTenant(c.req, authTenant(c)))))
  .post('/api/events', async (c) => c.json(await saveEvent(await catalogTenant(c.req, authTenant(c)), null, await c.req.json()), 201))
  .put('/api/events/:id', async (c) => { const result = await saveEvent(await catalogTenant(c.req, authTenant(c)), c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Evento não encontrado.', 404); })
  .post('/api/followups', async (c) => {
    const tenantId = await catalogTenant(c.req, authTenant(c));
    const body = await c.req.json().catch(() => null);
    if (!body || !isUuid(body.patientId) || !['combo', 'plan', 'event'].includes(body.offerType) || !isUuid(body.offerId)) return fail(c, 'Paciente e um combo, plano ou evento são obrigatórios; procedimento avulso é criado ao agendar ou registrar o atendimento.');
    try {
      if (body.offerType === 'combo') await requireClinicCapability(tenantId, 'catalog.combos');
      if (body.offerType === 'plan') await requireClinicCapability(tenantId, 'catalog.clinical_plans');
      if (body.offerType === 'combo' || body.offerType === 'plan') await requireClinicCapability(tenantId, 'followups');
      const created = await createFollowup(tenantId, body.patientId, body.offerType, body.offerId, { contractApplicationDate: body.contractApplicationDate });
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
  .post('/api/followup-contracts/:id/generate', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.generation'); await requireFollowupContractCapability(tenantId, c.req.param('id')); return c.json(await generateFollowupContract(tenantId, c.req.param('id'), clinicSession(c).userId)); } catch (error) { return handleError(c, error); } })
  .post('/api/followup-contracts/:id/retry', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.generation'); await requireFollowupContractCapability(tenantId, c.req.param('id')); return c.json(await retryFollowupContract(tenantId, c.req.param('id'), clinicSession(c).userId)); } catch (error) { return handleError(c, error); } })
  .post('/api/followup-contracts/:id/reprocess', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.generation'); await requireFollowupContractCapability(tenantId, c.req.param('id')); return c.json(await reprocessFollowupContract(tenantId, c.req.param('id'), clinicSession(c).userId)); } catch (error) { return handleError(c, error); } })
  .get('/api/signature-pending', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'dashboard.document_tasks'); return c.json(await listPendingSignatures(tenantId)); } catch (error) { return handleError(c, error); } })
  .get('/public/signatures/:token', async (c) => { try { const token = c.req.param('token')!; const signature = await readSignatureToken(token); return c.json({ ...signature, canSign: await signatureTokenCanSign(token) }); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/verify-phone', async (c) => { try { const body = await c.req.json().catch(() => ({})); return c.json(await verifySignaturePhone(c.req.param('token')!, body.phoneLast4)); } catch (error) { return handleError(c, error); } })
  .get('/public/signatures/:token/pdf', async (c) => { try { const bytes = await readSignaturePdf(c.req.param('token')!); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/preview', async (c) => { try { await requireSignatureTokenFollowupCapability(c.req.param('token')!); const body = await c.req.json().catch(() => ({})); const bytes = await previewSignature(c.req.param('token')!, body); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store', etag: createHash('sha256').update(bytes).digest('hex') } }); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/preview', requireClinicSession, async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireSignatureParticipantFollowupCapability(tenantId, c.req.param('id')!); const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); const bytes = await previewSignatureAsClinicRepresentative(c.req.param('id')!, body, actor); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store', etag: createHash('sha256').update(bytes).digest('hex') } }); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/confirm', async (c) => { try { await requireSignatureTokenFollowupCapability(c.req.param('token')!); const body = await c.req.json().catch(() => ({})); return c.json(await signWithToken(c.req.param('token')!, body.evidence, undefined, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/external/export', async (c) => { try { await requireSignatureTokenFollowupCapability(c.req.param('token')!); const body = await c.req.json().catch(() => ({})); return c.json(await exportExternalRevision(c.req.param('token')!, body, undefined, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .get('/public/signatures/:token/external/:attemptId/file', async (c) => { try { const bytes = await downloadExternalExport(c.req.param('token')!, c.req.param('attemptId')!); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="contrato-govbr.pdf"`, 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/external/import', async (c) => { try { await requireSignatureTokenFollowupCapability(c.req.param('token')!); const body = await c.req.json().catch(() => ({})); return c.json(await importExternalReturn(c.req.param('token')!, body, undefined, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/external/confirm', async (c) => { try { await requireSignatureTokenFollowupCapability(c.req.param('token')!); const body = await c.req.json().catch(() => ({})); return c.json(await confirmExternalReturn(c.req.param('token')!, body, undefined, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/external/cancel', async (c) => { try { await requireSignatureTokenFollowupCapability(c.req.param('token')!); const body = await c.req.json().catch(() => ({})); return c.json(await cancelExternalAttempt(c.req.param('token')!, body.attemptId)); } catch (error) { return handleError(c, error); } })
  .get('/public/signatures/:token/history', async (c) => { try { return c.json(await readSignatureHistoryByToken(c.req.param('token')!)); } catch (error) { return handleError(c, error); } })
  .get('/public/signatures/:token/revisions/:revisionId/pdf', async (c) => { try { const bytes = await readSignatureRevisionPdf(c.req.param('token')!, c.req.param('revisionId')!); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .get('/api/signature-history', async (c) => { try { const contractId = c.req.query('followupContractId') ?? ''; return c.json(await getSignatureHistory(await catalogTenant(c.req, authTenant(c)), contractId, { kind: 'panel' })); } catch (error) { return handleError(c, error); } })
  .get('/api/signature-participants/:id/revisions/:revisionId/pdf', requireClinicSession, async (c) => { try { const bytes = await readSignatureRevisionPdf(`participant:${c.req.param('id')!}`, c.req.param('revisionId')!, clinicSession(c)); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/external/export', requireClinicSession, async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireSignatureParticipantFollowupCapability(tenantId, c.req.param('id')!); const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); return c.json(await exportExternalRevisionAsClinicRepresentative(c.req.param('id')!, body, actor, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .get('/api/signature-participants/:id/external/:attemptId/file', requireClinicSession, async (c) => { try { const bytes = await downloadExternalExportAsClinicRepresentative(c.req.param('id')!, c.req.param('attemptId')!, clinicSession(c)); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="contrato-govbr.pdf"`, 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/external/import', requireClinicSession, async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireSignatureParticipantFollowupCapability(tenantId, c.req.param('id')!); const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); return c.json(await importExternalReturnAsClinicRepresentative(c.req.param('id')!, body, actor, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/external/confirm', requireClinicSession, async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireSignatureParticipantFollowupCapability(tenantId, c.req.param('id')!); const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); return c.json(await confirmExternalReturnAsClinicRepresentative(c.req.param('id')!, body, actor, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/external/cancel', requireClinicSession, async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireSignatureParticipantFollowupCapability(tenantId, c.req.param('id')!); const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); return c.json(await cancelExternalAttemptAsClinicRepresentative(c.req.param('id')!, body.attemptId, actor)); } catch (error) { return handleError(c, error); } })
  .get('/api/signature-participants/:id/pdf', requireClinicSession, async (c) => { try { const bytes = await readSignaturePdfForParticipant(c.req.param('id')!, clinicSession(c)); return new Response(bytes.buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, no-store' } }); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/confirm', requireClinicSession, async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireSignatureParticipantFollowupCapability(tenantId, c.req.param('id')!); const body = await c.req.json().catch(() => ({})); const actor = clinicSession(c); return c.json(await signAsClinicRepresentative(c.req.param('id')!, body.evidence, actor, { ip: observedClientIp(c) })); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/refresh', async (c) => { if (!isUuid(c.req.param('id'))) return fail(c, 'Participante inválido.'); try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireSignatureParticipantFollowupCapability(tenantId, c.req.param('id')); return c.json(await refreshSignatureToken(tenantId, c.req.param('id'))); } catch (error) { return handleError(c, error); } })
  .post('/api/followups/:id/items/:itemId/cancel', async (c) => {
    const tenantId = await catalogTenant(c.req, authTenant(c));
    if (!isUuid(c.req.param('id')) || !isUuid(c.req.param('itemId'))) return fail(c, 'Acompanhamento inválido.');
    try { await requireOfferMutationCapability(tenantId, c.req.param('id')); const result = await cancelFollowupItem(tenantId, c.req.param('id'), c.req.param('itemId')); return result ? c.json(result) : fail(c, 'Acompanhamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .post('/api/followups/:id/cancel', async (c) => {
    const tenantId = await catalogTenant(c.req, authTenant(c));
    if (!isUuid(c.req.param('id'))) return fail(c, 'Acompanhamento inválido.');
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body) || typeof body.reason !== 'string' || !body.reason.trim()) return fail(c, 'Motivo do cancelamento é obrigatório.');
    try { await requireOfferMutationCapability(tenantId, c.req.param('id')); const result = await cancelFollowup(tenantId, c.req.param('id'), body.reason); return result ? c.json(result) : fail(c, 'Acompanhamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .patch('/api/followups/:id/state', async (c) => {
    const tenantId = await catalogTenant(c.req, authTenant(c));
    if (!isUuid(c.req.param('id'))) return fail(c, 'Acompanhamento inválido.');
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body) || !['completed', 'cancelled'].includes(body.status)) return fail(c, 'Estado de acompanhamento inválido.');
    try { await requireOfferMutationCapability(tenantId, c.req.param('id')); const result = await updateFollowupState(tenantId, c.req.param('id'), body.status, body.reason); return result ? c.json(result) : fail(c, 'Acompanhamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .post('/api/payments', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body) || !isUuid(body.followupId) || !Number.isSafeInteger(body.amountCents) || body.amountCents <= 0 || !['cash', 'pix', 'credit_card'].includes(body.method)) return fail(c, 'Pagamento inválido.');
    try {
      const tenantId = await catalogTenant(c.req, authTenant(c));
      await requireOfferMutationCapability(tenantId, body.followupId);
      return c.json(await createPayment(tenantId, { followupId: body.followupId, amountCents: body.amountCents, method: body.method, installments: body.installments, notes: body.notes, receivedAt: body.receivedAt, idempotencyKey: body.idempotencyKey ?? c.req.header('idempotency-key') }), 201);
    } catch (error) { return handleError(c, error); }
  })
  .delete('/api/payments/:id', async (c) => {
    try {
      const tenantId = await catalogTenant(c.req, authTenant(c));
      const [payment] = await getDatabase().select({ followupId: payments.followupId }).from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.id, c.req.param('id'))));
      if (payment) await requireOfferMutationCapability(tenantId, payment.followupId);
      const result = await deletePayment(tenantId, c.req.param('id'), String((await c.req.json().catch(() => ({}))).reason ?? ''));
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
    try {
      const tenantId = await catalogTenant(c.req, authTenant(c));
      const body = await c.req.json().catch(() => null);
      if (Array.isArray(body?.items) && body.items.some((item: any) => item?.followupItemId)) await requireClinicCapability(tenantId, 'appointments.followup_sessions');
      return c.json(await createAppointment(tenantId, body), 201);
    } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/confirm', async (c) => {
    try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireFollowupSessionCapability(tenantId, c.req.param('id')); const body = await c.req.json().catch(() => ({})); return c.json(await confirmAppointment(tenantId, c.req.param('id'), Array.isArray(body?.selectedItemIds) ? body.selectedItemIds : undefined)); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/no-show', async (c) => {
    try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireFollowupSessionCapability(tenantId, c.req.param('id')); const body = await c.req.json().catch(() => ({})); const result = await updateAppointment(tenantId, c.req.param('id'), { status: 'no_show', reason: body.reason }); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/cancel', async (c) => {
    try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireFollowupSessionCapability(tenantId, c.req.param('id')); const result = await updateAppointment(tenantId, c.req.param('id'), { status: 'cancelled' }); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/attendance', async (c) => {
    try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireFollowupSessionCapability(tenantId, c.req.param('id')); const body = await c.req.json().catch(() => ({})); if (hasCustomAttendanceData(body.data)) await requireClinicCapability(tenantId, 'patient.custom_fields'); const [photos, customFields] = await Promise.all([clinicHasCapability(tenantId, 'patient.session_photos'), clinicHasCapability(tenantId, 'patient.custom_fields')]); return c.json(await createAttendance(tenantId, { ...body, appointmentId: c.req.param('id') }, photos, customFields), 201); } catch (error) { return handleError(c, error); }
  })
  .patch('/api/appointments/:id', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireFollowupSessionCapability(tenantId, c.req.param('id')); const result = await updateAppointment(tenantId, c.req.param('id'), await c.req.json().catch(() => ({}))); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .delete('/api/appointments/:id', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireFollowupSessionCapability(tenantId, c.req.param('id')); const result = await deleteAppointment(tenantId, c.req.param('id')); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .get('/api/attendances', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); const [photos, customFields] = await Promise.all([clinicHasCapability(tenantId, 'patient.session_photos'), clinicHasCapability(tenantId, 'patient.custom_fields')]); return c.json(await listAttendances(tenantId, photos, customFields)); } catch (error) { return handleError(c, error); } })
  .get('/api/attendances/:id', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); const [photos, customFields] = await Promise.all([clinicHasCapability(tenantId, 'patient.session_photos'), clinicHasCapability(tenantId, 'patient.custom_fields')]); const result = await getAttendance(tenantId, c.req.param('id'), photos, customFields); return result ? c.json(result) : fail(c, 'Atendimento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .post('/api/attendances', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); const body = await c.req.json().catch(() => ({})); if (body.appointmentId) await requireFollowupSessionCapability(tenantId, body.appointmentId); if (body.followupItemId) await requireClinicCapability(tenantId, 'appointments.followup_sessions'); if (hasCustomAttendanceData(body.data)) await requireClinicCapability(tenantId, 'patient.custom_fields'); const [photos, customFields] = await Promise.all([clinicHasCapability(tenantId, 'patient.session_photos'), clinicHasCapability(tenantId, 'patient.custom_fields')]); return c.json(await createAttendance(tenantId, body, photos, customFields), 201); } catch (error) { return handleError(c, error); } })
  .patch('/api/attendances/:id', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireFollowupAttendanceCapability(tenantId, c.req.param('id')); const body = await c.req.json().catch(() => ({})); if (body.data !== undefined) await requireClinicCapability(tenantId, 'patient.custom_fields'); const [photos, customFields] = await Promise.all([clinicHasCapability(tenantId, 'patient.session_photos'), clinicHasCapability(tenantId, 'patient.custom_fields')]); const result = await updateAttendance(tenantId, c.req.param('id'), body, photos, customFields); return result ? c.json(result) : fail(c, 'Atendimento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .patch('/api/attendances/:id/cancel', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireFollowupAttendanceCapability(tenantId, c.req.param('id')); const body = await c.req.json().catch(() => ({})); const [photos, customFields] = await Promise.all([clinicHasCapability(tenantId, 'patient.session_photos'), clinicHasCapability(tenantId, 'patient.custom_fields')]); return c.json(await cancelAttendance(tenantId, c.req.param('id'), String(body.reason ?? ''), photos, customFields)); } catch (error) { return handleError(c, error); } })
  .post('/api/uploads/presign', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.contentType !== 'string' || !/^image\/(jpeg|png|webp)$/.test(body.contentType) || !Number.isInteger(body.size) || body.size < 1 || body.size > 10_000_000 || !isUuid(body.attendanceId)) return fail(c, 'Imagem ou atendimento inválido.');
    try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'patient.session_photos'); await requireAttendanceFollowupCapability(tenantId, body.attendanceId); const result = await presignAttendancePhoto(tenantId, body.attendanceId, body.contentType, typeof body.contentHash === 'string' ? body.contentHash : null); return c.json(result); }
    catch (error) { return handleError(c, error); }
  })
  .post('/api/attendances/:id/photos', async (c) => {
    try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'patient.session_photos'); await requireAttendanceFollowupCapability(tenantId, c.req.param('id')); return c.json(await addAttendancePhoto(tenantId, c.req.param('id'), await c.req.json().catch(() => null)), 201); } catch (error) { return handleError(c, error); }
  })
  .delete('/api/attendances/:id/photos/:photoId', async (c) => {
    try {
      const tenantId = await catalogTenant(c.req, authTenant(c));
      await requireClinicCapability(tenantId, 'patient.session_photos');
      await requireAttendanceFollowupCapability(tenantId, c.req.param('id'));
      const result = await removeAttendancePhoto(tenantId, c.req.param('id'), c.req.param('photoId'));
      try { await deleteObject(result.objectKey); } catch (error) { console.error(error); }
      return c.json({ deleted: true });
    } catch (error) { return handleError(c, error); }
  })
  .post('/api/patient-anamneses', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'anamnesis.in_clinic'); const body = await c.req.json(); if (!isUuid(body?.patientId) || !isUuid(body?.anamnesisId) || (!isUuid(body?.followupId) && !isUuid(body?.procedureId))) return fail(c, 'Paciente, procedimento ou acompanhamento e anamnese são obrigatórios.'); if (body.followupId) await requireOfferMutationCapability(tenantId, body.followupId); return c.json(await createAppliedAnamnesis(tenantId, body), 201); } catch (error) { return handleError(c, error); } })
  .post('/api/anamnesis-requests', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'anamnesis.public_links'); const body = await c.req.json(); if (!isUuid(body?.patientAnamnesisId)) return fail(c, 'Anamnese aplicada inválida.'); await requireAppliedAnamnesisFollowupCapability(tenantId, body.patientAnamnesisId); return c.json(await createAnamnesisRequest(tenantId, body.patientAnamnesisId), 201); } catch (error) { return handleError(c, error); } })
  .put('/api/anamnesis-requests/:id/refresh', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'anamnesis.public_links'); await requireAppliedAnamnesisFollowupCapability(tenantId, c.req.param('id')); return c.json(await refreshAnamnesisRequest(tenantId, c.req.param('id'))); } catch (error) { return handleError(c, error); } })
  .get('/public/anamnesis/:token', async (c) => { try { await requirePublicAnamnesisCapability(c.req.param('token')); const result = await readPublicAnamnesis(c.req.param('token')); return result ? c.json(result) : fail(c, 'Link inválido, expirado ou já enviado.', 404); } catch (error) { return handleError(c, error); } })
  .put('/public/anamnesis/:token/draft', async (c) => { try { await requirePublicAnamnesisCapability(c.req.param('token')); const body = await c.req.json().catch(() => null); if (!isRecord(body?.draft)) return fail(c, 'Rascunho inválido.'); return await saveAnamnesisDraft(c.req.param('token'), body.draft) ? c.json({ saved: true }) : fail(c, 'Link inválido ou expirado.', 404); } catch (error) { return handleError(c, error); } })
  .post('/public/anamnesis/:token/submit', async (c) => { try { await requirePublicAnamnesisCapability(c.req.param('token')); const body = await c.req.json().catch(() => null); if (!isRecord(body?.answers)) return fail(c, 'Respostas inválidas.'); const result = await submitPublicAnamnesis(c.req.param('token'), body.answers); return result ? c.json(result, 201) : fail(c, 'Link inválido, expirado ou já enviado.', 409); } catch (error) { return handleError(c, error); } })
  .get('/api/patient-anamneses/:id', async (c) => { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'anamnesis.in_clinic'); await requireAppliedAnamnesisFollowupCapability(tenantId, c.req.param('id')); const result = await readAppliedAnamnesis(tenantId, c.req.param('id')); return result ? c.json(result) : fail(c, 'Anamnese não encontrada.', 404); })
  .post('/api/patient-anamneses/:id/answers', async (c) => { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'anamnesis.in_clinic'); await requireAppliedAnamnesisFollowupCapability(tenantId, c.req.param('id')); const body = await c.req.json().catch(() => null); if (!isRecord(body?.answers)) return fail(c, 'Respostas inválidas.'); const result = await answerAppliedAnamnesis(tenantId, c.req.param('id'), body.answers); return result ? c.json({ submitted: true }, 201) : fail(c, 'Anamnese não encontrada ou já respondida.', 404); })
  .post('/api/anamnesis-responses/:id/notes', async (c) => { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'anamnesis.in_clinic'); await requireAppliedAnamnesisFollowupCapability(tenantId, c.req.param('id')); const body = await c.req.json().catch(() => null); const result = await addAnamnesisNote(tenantId, c.req.param('id'), body?.content ?? ''); return result ? c.json(result, 201) : fail(c, 'Resposta não encontrada ou ainda não enviada.', 404); })
  .get('/api/anamnesis-responses/:id/notes', async (c) => { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'anamnesis.in_clinic'); await requireAppliedAnamnesisFollowupCapability(tenantId, c.req.param('id')); const result = await listAnamnesisNotes(tenantId, c.req.param('id')); return result ? c.json(result) : fail(c, 'Resposta não encontrada ou ainda não enviada.', 404); })
  .post('/api/followup-contracts/:id/documents/presign', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.generation'); await requireFollowupContractCapability(tenantId, c.req.param('id')); const body = await c.req.json().catch(() => ({})); return c.json(await presignAppliedDocument(tenantId, c.req.param('id'), body.contentType, body.contentHash, body.size)); } catch (error) { return handleError(c, error); } })
  .post('/api/followup-contracts/:id/documents', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); await requireClinicCapability(tenantId, 'contracts.generation'); await requireFollowupContractCapability(tenantId, c.req.param('id')); const body = await c.req.json().catch(() => ({})); const result = await materializeAppliedDocumentResult(tenantId, c.req.param('id'), body); return c.json(result.document, result.existing ? 200 : 201); } catch (error) { return handleError(c, error); } })
   .get('/api/followup-contracts/:id/documents', async (c) => { const result = await listAppliedDocuments(await catalogTenant(c.req, authTenant(c)), c.req.param('id')); return result ? c.json(result) : fail(c, 'Contrato aplicado não encontrado.', 404); })
  .get('/api/applied-documents/:id', async (c) => { const result = await getAppliedDocument(await catalogTenant(c.req, authTenant(c)), c.req.param('id')); return result ? c.json(result) : fail(c, 'Documento não encontrado.', 404); })
  .delete('/api/applied-documents/:id', async (c) => { try { const tenantId = await catalogTenant(c.req, authTenant(c)); const id = c.req.param('id'); await requireAppliedDocumentFollowupCapability(tenantId, id); const result = await deleteAppliedDocument(tenantId, id); if (!result) return fail(c, 'Documento não encontrado.', 404); return c.json(result, result.cleanup.status === 'failed' ? 503 : 200); } catch (error) { return handleError(c, error); } })
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
       const [photos, customFields] = await Promise.all([clinicHasCapability(tenantId, 'patient.session_photos'), clinicHasCapability(tenantId, 'patient.custom_fields')]);
       const history = await getRelationalHistory(tenantId, c.req.param('id'), clinicSession(c).userId, photos, customFields);
      return history ? c.json(history) : fail(c, 'Paciente não encontrado.', 404);
    } catch (error) { return handleError(c, error); }
  });
