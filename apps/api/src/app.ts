import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { isValidObjectId } from 'mongoose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getDatabasePool, Anamnesis, Contract, Combo, Plan, Patient, PatientAnamnesis, Payment, Followup, Appointment, Attendance, Procedure } from '@clinicare/db';
import { DEFAULT_TENANT_ID, createPatient, deactivatePatient, getPatient, isUuid, listPatients, patientActorFromRequest, updatePatient } from './patients';
import { catalogTenant, listProcedures, createProcedure, updateProcedure, listAnamneses, createAnamnesis, updateAnamnesis, addAnamnesisVersion, associateAnamnesis, listCombos, saveCombo, listContracts, saveContract, addContractVersion, listPlans, savePlan } from './catalog';
import { buildRelationship } from './relationship';
import { createFollowup, getFollowup, listFollowups, cancelFollowup, updateFollowupState } from './followups';
import { listPendingSignatures, readSignatureToken, refreshSignatureToken, signWithToken } from './signatures';
import { addAttendancePhoto, cancelAttendance, confirmAppointment, createAppointment, createAttendance, deleteAppointment, getAttendance, listAppointments, listAttendances, removeAttendancePhoto, updateAppointment, updateAttendance } from './scheduling';
import { uploadUrl, uploadUrlForDocument, deleteObject } from './storage';

const fail = (c: Context, message: string, status: 400 | 403 | 404 | 409 | 503 = 400) => c.json({ error: message }, status);
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isRecord = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const validSchema = (value: unknown) => isRecord(value) && value.type === 'object' && isRecord(value.properties);
const validDuration = (value: unknown) => Number.isInteger(value) && (value as number) > 0 && (value as number) <= 1440;
const expiry = (days: number) => new Date(Date.now() + days * 86400000);
const handleError = (c: Context, error: unknown) => {
  const explicitStatus = error && typeof error === 'object' && 'status' in error ? (error as { status: number }).status : undefined;
  if (explicitStatus && [400, 403, 404, 409].includes(explicitStatus) && error instanceof Error) return c.json({ error: error.message }, explicitStatus as 400 | 403 | 404 | 409);
  const errorCode = error && typeof error === 'object' && 'code' in error ? (error as { code: string | number }).code : undefined;
  const causeCode = error instanceof Error && error.cause && typeof error.cause === 'object' && 'code' in error.cause ? (error.cause as { code: string | number }).code : undefined;
  if ([errorCode, causeCode].includes('23505') || [errorCode, causeCode].includes(11000)) return c.json({ error: 'Este registro já existe.' }, 409);
  if ([errorCode, causeCode].includes('23503') || [errorCode, causeCode].includes('23514') || [errorCode, causeCode].includes('22P02')) return c.json({ error: 'Dados inválidos ou referência não encontrada.' }, 400);
  if (error instanceof Error && error.name === 'ValidationError') return c.json({ error: error.message }, 400);
  if (error instanceof Error && error.message === 'Tenant não encontrado.') return c.json({ error: error.message }, 400);
  if (error instanceof Error && /^(Informe|Dados ou|Combo requer|Combo não|Plano |Procedimento não|Contrato não|Versão não|Formulário inválido|Motivo do cancelamento|O acompanhamento)/i.test(error.message)) return c.json({ error: error.message }, 400);
  if (error instanceof Error && /conflito|versão desatualizada/i.test(error.message)) return c.json({ error: error.message }, 409);
  if (error instanceof Error && /^(DATA_ENCRYPTION_KEY|SEARCH_HMAC_KEY)/.test(error.message)) return c.json({ error: error.message }, 503);
  console.error(error);
  return c.json({ error: 'Ocorreu um erro inesperado.' }, 500);
};

type OfferItem = { procedureId: unknown; procedureName: string; sessionsTotal: number; durationMinutes: number; sessionSchema: unknown; priceCents: number; anamneses: unknown[] };
type ResolvedOffer = { name: string; priceCents: number; items: OfferItem[]; comboIds: unknown[]; contractIds: unknown[]; requireNewAnamnesis: boolean; validUntil: Date | null };
const minimumSessions = (procedure: any) => Number.isInteger(procedure?.baseSessions) && procedure.baseSessions > 0 ? procedure.baseSessions : 1;
const legacySessions = minimumSessions;
const procedureItem = (procedure: any, override: { sessions?: number | null; priceCents?: number | null } = {}): OfferItem => ({ procedureId: procedure._id, procedureName: procedure.name, sessionsTotal: override.sessions ?? 1, durationMinutes: procedure.durationMinutes ?? 60, sessionSchema: procedure.sessionSchema, priceCents: override.priceCents ?? procedure.priceCents, anamneses: [] });
const comboAvailable = (combo: any) => { const today = new Date(); return combo.active && !(combo.validFrom && combo.validFrom > today) && !(combo.validUntil && combo.validUntil < today); };
// Valor integral = soma de (preço do procedimento × sessões). Combo nunca abaixo dele; promoção nunca acima do preço do combo.
async function comboPriceError(items: any[], priceCents: number, promotionalPriceCents: number | null) {
  const procedures = await Procedure.find({ _id: { $in: items.map((item) => item.procedureId?._id ?? item.procedureId) } }).select('+baseSessions').lean();
  const integral = items.reduce((total, item) => {
    const procedure: any = procedures.find((candidate: any) => String(candidate._id) === String(item.procedureId?._id ?? item.procedureId));
    return total + (item.priceOverrideCents ?? procedure?.priceCents ?? 0) * (item.sessions ?? item.sessionsOverride ?? minimumSessions(procedure));
  }, 0);
  const belowMinimum = items.find((item) => {
    const procedure: any = procedures.find((candidate: any) => String(candidate._id) === String(item.procedureId?._id ?? item.procedureId));
    return (item.sessions ?? item.sessionsOverride ?? minimumSessions(procedure)) < minimumSessions(procedure);
  });
  if (belowMinimum) return 'A quantidade do combo não pode ser menor que as sessões base do procedimento.';
  if (priceCents < integral) return `O preço do combo não pode ser menor que o valor integral dos procedimentos (${(integral / 100).toFixed(2).replace('.', ',')}).`;
  if (promotionalPriceCents != null && promotionalPriceCents > priceCents) return 'O preço promocional não pode ser maior que o preço do combo.';
  return null;
}
const comboItems = (combo: any) => combo.items.map((item: any) => procedureItem(item.procedureId, { sessions: item.sessions ?? item.sessionsOverride ?? legacySessions(item.procedureId), priceCents: item.priceOverrideCents }));
async function resolveOffer(offerType: string, offerId: string): Promise<ResolvedOffer | { error: string; status: 404 | 409 }> {
  if (offerType === 'procedure') {
    const procedure = await Procedure.findById(offerId).select('+baseSessions').lean();
    if (!procedure || !procedure.active) return { error: 'Procedimento não encontrado.', status: 404 };
    return { name: procedure.name, priceCents: procedure.priceCents, items: [procedureItem(procedure)], comboIds: [], contractIds: [], requireNewAnamnesis: procedure.requireNewAnamnesis === true, validUntil: null };
  }
  if (offerType === 'combo') {
    const combo = await Combo.findById(offerId).populate({ path: 'items.procedureId', select: '+baseSessions' }).lean() as any;
    if (!combo || !combo.active) return { error: 'Combo não encontrado.', status: 404 };
    if (!comboAvailable(combo)) return { error: 'Combo fora da validade.', status: 409 };
    return { name: combo.name, priceCents: combo.promotionalPriceCents ?? combo.priceCents, items: comboItems(combo), comboIds: [combo._id], contractIds: [], requireNewAnamnesis: combo.requireNewAnamnesis === true, validUntil: null };
  }
  const plan = await Plan.findById(offerId).lean() as any;
  if (!plan || !plan.active) return { error: 'Plano não encontrado.', status: 404 };
  const items: OfferItem[] = [], comboIds: unknown[] = [];
  let requireNewAnamnesis = plan.requireNewAnamnesis === true;
  for (const entry of plan.items) {
    if (entry.offerType === 'procedure') {
      const procedure = await Procedure.findById(entry.offerId).select('+baseSessions').lean();
      if (procedure?.active) { items.push(procedureItem(procedure, { sessions: entry.sessions ?? legacySessions(procedure) })); requireNewAnamnesis ||= procedure.requireNewAnamnesis === true; }
    } else {
      const combo = await Combo.findById(entry.offerId).populate({ path: 'items.procedureId', select: '+baseSessions' }).lean() as any;
      if (combo?.active) { items.push(...comboItems(combo)); comboIds.push(combo._id); requireNewAnamnesis ||= combo.requireNewAnamnesis === true; }
    }
  }
  if (!items.length) return { error: 'Plano sem procedimentos disponíveis.', status: 409 };
  return { name: plan.name, priceCents: plan.priceCents, items, comboIds, contractIds: plan.contractIds, requireNewAnamnesis, validUntil: plan.validityDays ? expiry(plan.validityDays) : null };
}
// Contrata uma oferta para o paciente: congela itens e preço, deriva contratos e gera as anamneses pendentes (reaproveitando as ainda válidas).
async function startFollowup(patientId: unknown, offerType: string, offerId: string) {
  const offer = await resolveOffer(offerType, offerId);
  if ('error' in offer) return offer;
  const procedureIds = offer.items.map((item) => item.procedureId);
  const [contracts, forms] = await Promise.all([
    Contract.find({ active: true, $or: [{ kind: 'standard' }, { kind: 'procedure', procedureId: { $in: procedureIds } }, { kind: 'combo', comboId: { $in: offer.comboIds } }, { _id: { $in: offer.contractIds } }] }).lean(),
    Anamnesis.find({ procedureIds: { $in: procedureIds }, active: true, requiredByDefault: true }).lean(),
  ]);
  for (const item of offer.items) item.anamneses = forms.filter((form: any) => form.procedureIds.some((id: any) => String(id) === String(item.procedureId))).map((form: any) => ({ anamnesisId: form._id, required: true, version: form.versions.at(-1)?.version, schemaSnapshot: form.versions.at(-1)?.schema }));
  const followup = await Followup.create({ patientId, offerType, offerId, offerName: offer.name, priceCents: offer.priceCents, validUntil: offer.validUntil, items: offer.items, contracts: contracts.map((contract: any) => ({ contractId: contract._id, title: contract.title, version: contract.versions.at(-1)?.version, contentSnapshot: contract.versions.at(-1)?.content, objectKey: contract.versions.at(-1)?.sourceObjectKey })) });
  const now = new Date();
  for (const form of forms as any[]) {
    const reusable = offer.requireNewAnamnesis ? null : await PatientAnamnesis.exists({ patientId, anamnesisId: form._id, 'response.validUntil': { $gt: now } });
    if (reusable) continue;
    const current = form.versions.at(-1);
    await PatientAnamnesis.create({ patientId, anamnesisId: form._id, followupId: followup._id, version: current.version, schemaSnapshot: current.schema, required: true });
  }
  return { followup };
}
const liveStatuses = ['planned', 'confirmed', 'rescheduled'];
// Procedimento avulso também é cobrado e exige anamnese: é um acompanhamento de uma única sessão, criado ao agendar ou registrar e reaproveitado enquanto não for usado.
async function openStandalone(patientId: unknown, procedure: any) {
  const candidates: any[] = await Followup.find({ patientId, offerType: 'procedure', offerId: procedure._id, 'items.0.sessionsPerformed': 0 }).lean();
  for (const candidate of candidates) if (!await Appointment.exists({ 'items.followupId': candidate._id, status: { $in: liveStatuses } })) return { followup: await Followup.findById(candidate._id) as any };
  const started = await startFollowup(patientId, 'procedure', String(procedure._id));
  return 'error' in started ? started : { followup: started.followup as any };
}
const pendingForms = (followupIds: unknown[]) => PatientAnamnesis.find({ followupId: { $in: followupIds }, required: true, 'response.submittedAt': null }).populate('anamnesisId', 'title').lean();
// Ao cancelar ou apagar um agendamento, descarta o avulso que ainda não foi realizado nem pago.
async function dropUnusedStandalone(appointment: any) {
  for (const item of appointment?.items ?? []) {
    if (!item.followupId) continue;
    const followup: any = await Followup.findById(item.followupId).lean();
    if (!followup || followup.offerType !== 'procedure' || followup.items.some((entry: any) => entry.sessionsPerformed > 0)) continue;
    if (await Payment.exists({ followupId: followup._id }) || await Appointment.exists({ _id: { $ne: appointment._id }, 'items.followupId': followup._id, status: { $in: liveStatuses } })) continue;
    await Promise.all([Followup.deleteOne({ _id: followup._id }), PatientAnamnesis.deleteMany({ followupId: followup._id, 'response.submittedAt': null })]);
  }
}
// Contrato padrão vale para todos; o específico precisa apontar para um procedimento ou combo existente.
async function contractTarget(input: any): Promise<{ procedureId: unknown; comboId: unknown } | { error: string; status: 400 | 404 }> {
  if (input.kind === 'procedure') {
    if (!isValidObjectId(input.procedureId)) return { error: 'Escolha o procedimento do contrato.', status: 400 };
    if (!await Procedure.exists({ _id: input.procedureId })) return { error: 'Procedimento não encontrado.', status: 404 };
    return { procedureId: input.procedureId, comboId: null };
  }
  if (input.kind === 'combo') {
    if (!isValidObjectId(input.comboId)) return { error: 'Escolha o combo do contrato.', status: 400 };
    if (!await Combo.exists({ _id: input.comboId })) return { error: 'Combo não encontrado.', status: 404 };
    return { procedureId: null, comboId: input.comboId };
  }
  return { procedureId: null, comboId: null };
}
const monthsFromNow = (months: number) => { const date = new Date(); date.setMonth(date.getMonth() + months); return date; };
const buildResponse = async (anamnesisId: unknown, answers: Record<string, unknown>) => ({ answers, submittedAt: new Date(), validUntil: monthsFromNow(((await Anamnesis.findById(anamnesisId).lean()) as any)?.validityMonths ?? 12) });

const appointmentStatusLabel: Record<string, string> = { planned: 'agendado', confirmed: 'confirmado', rescheduled: 'remarcado', cancelled: 'cancelado', no_show: 'faltou' };
export const app = new Hono()
  .use('/api/*', cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
  .onError((error, c) => handleError(c, error))
  .get('/api/health', async (c) => {
    try { await getDatabasePool().query('select 1'); return c.json({ status: 'ok', service: 'clinicare-api', database: 'connected' }); }
    catch { return c.json({ status: 'unavailable', service: 'clinicare-api', database: 'disconnected' }, 503); }
  })
  .get('/api/patients', async (c) => {
    const tenantId = c.req.header('x-tenant-id') ?? DEFAULT_TENANT_ID;
    if (!isUuid(tenantId)) return fail(c, 'Tenant inválido.');
    return c.json(await listPatients(tenantId, c.req.query('query') ?? c.req.query('q'), patientActorFromRequest(c.req)));
  })
  .get('/api/patients/:id', async (c) => {
    const tenantId = c.req.header('x-tenant-id') ?? DEFAULT_TENANT_ID;
    if (!isUuid(tenantId)) return fail(c, 'Tenant inválido.');
    const patient = await getPatient(tenantId, c.req.param('id'), patientActorFromRequest(c.req));
    return patient ? c.json(patient) : fail(c, 'Paciente não encontrado.', 404);
  })
  .post('/api/patients', async (c) => {
    const tenantId = c.req.header('x-tenant-id') ?? DEFAULT_TENANT_ID;
    if (!isUuid(tenantId)) return fail(c, 'Tenant inválido.');
    const body = await c.req.json().catch(() => null);
    if (!body) return fail(c, 'Dados do paciente inválidos.');
    return c.json(await createPatient(tenantId, body, patientActorFromRequest(c.req)), 201);
  })
  .put('/api/patients/:id', async (c) => {
    const tenantId = c.req.header('x-tenant-id') ?? DEFAULT_TENANT_ID;
    if (!isUuid(tenantId)) return fail(c, 'Tenant inválido.');
    const body = await c.req.json().catch(() => null);
    if (!body) return fail(c, 'Dados do paciente inválidos.');
    const patient = await updatePatient(tenantId, c.req.param('id'), body, patientActorFromRequest(c.req));
    return patient ? c.json(patient) : fail(c, 'Paciente não encontrado.', 404);
  })
  .delete('/api/patients/:id', async (c) => {
    const tenantId = c.req.header('x-tenant-id') ?? DEFAULT_TENANT_ID;
    if (!isUuid(tenantId)) return fail(c, 'Tenant inválido.');
    const patient = await deactivatePatient(tenantId, c.req.param('id'), patientActorFromRequest(c.req));
    if (patient && 'conflict' in patient) return fail(c, patient.conflict, 409);
    return patient ? c.json(patient) : fail(c, 'Paciente não encontrado.', 404);
  })
  .get('/api/procedures', async (c) => c.json(await listProcedures(await catalogTenant(c.req))))
  .post('/api/procedures', async (c) => { const body = await c.req.json().catch(() => null); if (!body || typeof body.name !== 'string' || body.name.trim().length < 2 || !Number.isInteger(body.durationMinutes) || body.durationMinutes < 1 || !Number.isSafeInteger(body.priceCents ?? 0) || body.priceCents < 0) return fail(c, 'Dados ou formulário de procedimento inválidos.'); return c.json(await createProcedure(await catalogTenant(c.req), body), 201); })
  .put('/api/procedures/:id', async (c) => { const body = await c.req.json().catch(() => null); if (!isRecord(body) || !isUuid(c.req.param('id'))) return fail(c, 'Dados de procedimento inválidos.'); const result = await updateProcedure(await catalogTenant(c.req), c.req.param('id'), body); return result ? c.json(result) : fail(c, 'Procedimento não encontrado.', 404); })
  .get('/api/anamneses', async (c) => c.json(await listAnamneses(await catalogTenant(c.req))))
  .post('/api/anamneses', async (c) => c.json(await createAnamnesis(await catalogTenant(c.req), await c.req.json()), 201))
  .patch('/api/anamneses/:id', async (c) => { const result = await updateAnamnesis(await catalogTenant(c.req), c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Formulário de anamnese não encontrado.', 404); })
  .post('/api/anamneses/:id/versions', async (c) => { const result = await addAnamnesisVersion(await catalogTenant(c.req), c.req.param('id'), await c.req.json()); return result ? c.json(result, 201) : fail(c, 'Formulário de anamnese não encontrado.', 404); })
  .put('/api/anamneses/:id/associations', async (c) => { const body = await c.req.json(); const result = await associateAnamnesis(await catalogTenant(c.req), c.req.param('id'), body?.procedures ?? []); return result ? c.json(result) : fail(c, 'Anamnese não encontrada.', 404); })
  .get('/api/combos', async (c) => c.json(await listCombos(await catalogTenant(c.req))))
  .post('/api/combos', async (c) => c.json(await saveCombo(await catalogTenant(c.req), null, await c.req.json()), 201))
  .put('/api/combos/:id', async (c) => { const result = await saveCombo(await catalogTenant(c.req), c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Combo não encontrado.', 404); })
  .get('/api/contracts', async (c) => c.json(await listContracts(await catalogTenant(c.req))))
  .post('/api/contracts', async (c) => c.json(await saveContract(await catalogTenant(c.req), null, await c.req.json()), 201))
  .patch('/api/contracts/:id', async (c) => { const result = await saveContract(await catalogTenant(c.req), c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Contrato não encontrado.', 404); })
  .post('/api/contracts/:id/versions', async (c) => { const result = await addContractVersion(await catalogTenant(c.req), c.req.param('id'), await c.req.json()); return result ? c.json(result, 201) : fail(c, 'Contrato não encontrado.', 404); })
  .get('/api/plans', async (c) => c.json(await listPlans(await catalogTenant(c.req))))
  .post('/api/plans', async (c) => c.json(await savePlan(await catalogTenant(c.req), null, await c.req.json()), 201))
  .put('/api/plans/:id', async (c) => { const result = await savePlan(await catalogTenant(c.req), c.req.param('id'), await c.req.json()); return result ? c.json(result) : fail(c, 'Plano não encontrado.', 404); })
  .post('/api/followups', async (c) => {
    const tenantId = await catalogTenant(c.req);
    const body = await c.req.json().catch(() => null);
    if (!body || !isUuid(body.patientId) || !['combo', 'plan'].includes(body.offerType) || !isUuid(body.offerId)) return fail(c, 'Paciente e um combo ou plano são obrigatórios; procedimento avulso é criado ao agendar ou registrar o atendimento.');
    try { return c.json(await createFollowup(tenantId, body.patientId, body.offerType, body.offerId), 201); } catch (error) { return handleError(c, error); }
  })
  .get('/api/followups', async (c) => {
    return c.json(await listFollowups(await catalogTenant(c.req)));
  })
  .get('/api/followups/:id', async (c) => {
    const tenantId = await catalogTenant(c.req);
    if (!isUuid(c.req.param('id'))) return fail(c, 'Acompanhamento inválido.');
    const result = await getFollowup(tenantId, c.req.param('id'));
    return result ? c.json(result) : fail(c, 'Acompanhamento não encontrado.', 404);
  })
  .get('/api/signature-pending', async (c) => { try { return c.json(await listPendingSignatures(await catalogTenant(c.req))); } catch (error) { return handleError(c, error); } })
  .get('/public/signatures/:token', async (c) => { try { return c.json(await readSignatureToken(c.req.param('token'))); } catch (error) { return handleError(c, error); } })
  .post('/public/signatures/:token/confirm', async (c) => { try { return c.json(await signWithToken(c.req.param('token'), (await c.req.json().catch(() => ({}))).evidence)); } catch (error) { return handleError(c, error); } })
  .post('/api/signature-participants/:id/refresh', async (c) => { if (!isUuid(c.req.param('id'))) return fail(c, 'Participante inválido.'); try { return c.json(await refreshSignatureToken(await catalogTenant(c.req), c.req.param('id'))); } catch (error) { return handleError(c, error); } })
  .post('/api/followups/:id/cancel', async (c) => {
    const tenantId = await catalogTenant(c.req);
    if (!isUuid(c.req.param('id'))) return fail(c, 'Acompanhamento inválido.');
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body) || typeof body.reason !== 'string' || !body.reason.trim()) return fail(c, 'Motivo do cancelamento é obrigatório.');
    try { const result = await cancelFollowup(tenantId, c.req.param('id'), body.reason); return result ? c.json(result) : fail(c, 'Acompanhamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .patch('/api/followups/:id/state', async (c) => {
    const tenantId = await catalogTenant(c.req);
    if (!isUuid(c.req.param('id'))) return fail(c, 'Acompanhamento inválido.');
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body) || !['completed', 'cancelled'].includes(body.status)) return fail(c, 'Estado de acompanhamento inválido.');
    try { const result = await updateFollowupState(tenantId, c.req.param('id'), body.status, body.reason); return result ? c.json(result) : fail(c, 'Acompanhamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .post('/api/payments', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !isValidObjectId(body.followupId) || !Number.isSafeInteger(body.amountCents) || body.amountCents <= 0 || !['cash', 'pix', 'credit_card'].includes(body.method)) return fail(c, 'Pagamento inválido.');
    if (!await Followup.exists({ _id: body.followupId })) return fail(c, 'Acompanhamento não encontrado.', 404);
    return c.json(await Payment.create(body), 201);
  })
  .get('/api/appointments', async (c) => {
    try { const tenantId = await catalogTenant(c.req); const from = c.req.query('from') ? new Date(c.req.query('from')!) : new Date(Date.now() - 7 * 86400000), to = c.req.query('to') ? new Date(c.req.query('to')!) : expiry(14); return c.json(await listAppointments(tenantId, from, to)); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments', async (c) => {
    try { return c.json(await createAppointment(await catalogTenant(c.req), await c.req.json().catch(() => null)), 201); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/confirm', async (c) => {
    try { const body = await c.req.json().catch(() => ({})); return c.json(await confirmAppointment(await catalogTenant(c.req), c.req.param('id'), Array.isArray(body?.selectedItemIds) ? body.selectedItemIds : undefined)); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/no-show', async (c) => {
    try { const result = await updateAppointment(await catalogTenant(c.req), c.req.param('id'), { status: 'no_show' }); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/cancel', async (c) => {
    try { const result = await updateAppointment(await catalogTenant(c.req), c.req.param('id'), { status: 'cancelled' }); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); }
  })
  .post('/api/appointments/:id/attendance', async (c) => {
    try { return c.json(await createAttendance(await catalogTenant(c.req), { ...(await c.req.json().catch(() => ({}))), appointmentId: c.req.param('id') }), 201); } catch (error) { return handleError(c, error); }
  })
  .patch('/api/appointments/:id', async (c) => { try { const result = await updateAppointment(await catalogTenant(c.req), c.req.param('id'), await c.req.json().catch(() => ({}))); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .delete('/api/appointments/:id', async (c) => { try { const result = await deleteAppointment(await catalogTenant(c.req), c.req.param('id')); return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .get('/api/attendances', async (c) => { try { return c.json(await listAttendances(await catalogTenant(c.req))); } catch (error) { return handleError(c, error); } })
  .get('/api/attendances/:id', async (c) => { try { const result = await getAttendance(await catalogTenant(c.req), c.req.param('id')); return result ? c.json(result) : fail(c, 'Atendimento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .post('/api/attendances', async (c) => { try { return c.json(await createAttendance(await catalogTenant(c.req), await c.req.json().catch(() => ({}))), 201); } catch (error) { return handleError(c, error); } })
  .patch('/api/attendances/:id', async (c) => { try { const result = await updateAttendance(await catalogTenant(c.req), c.req.param('id'), await c.req.json().catch(() => ({}))); return result ? c.json(result) : fail(c, 'Atendimento não encontrado.', 404); } catch (error) { return handleError(c, error); } })
  .patch('/api/attendances/:id/cancel', async (c) => { try { const body = await c.req.json().catch(() => ({})); return c.json(await cancelAttendance(await catalogTenant(c.req), c.req.param('id'), String(body.reason ?? ''))); } catch (error) { return handleError(c, error); } })
  .post('/api/uploads/presign', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.contentType !== 'string' || !/^image\/(jpeg|png|webp)$/.test(body.contentType) || !Number.isInteger(body.size) || body.size < 1 || body.size > 10_000_000) return fail(c, 'Imagem inválida ou maior que 10 MB.');
    const key = `uploads/${randomUUID()}`;
    try { return c.json({ uploadUrl: await uploadUrl(key, body.contentType), objectKey: key, expiresInSeconds: 300 }); }
    catch { return c.json({ error: 'R2 não configurado.' }, 503); }
  })
  .post('/api/attendances/:id/photos', async (c) => {
    try { return c.json(await addAttendancePhoto(await catalogTenant(c.req), c.req.param('id'), await c.req.json().catch(() => null)), 201); } catch (error) { return handleError(c, error); }
  })
  .delete('/api/attendances/:id/photos/:photoId', async (c) => {
    try {
      const result = await removeAttendancePhoto(await catalogTenant(c.req), c.req.param('id'), c.req.param('photoId'));
      try { await deleteObject(result.objectKey); } catch (error) { console.error(error); }
      return c.json({ deleted: true });
    } catch (error) { return handleError(c, error); }
  })
  .post('/api/patient-anamneses', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !isValidObjectId(body.patientId) || !isValidObjectId(body.anamnesisId)) return fail(c, 'Paciente e anamnese são obrigatórios.');
    const [patient, anamnesis] = await Promise.all([Patient.exists({ _id: body.patientId }), Anamnesis.findById(body.anamnesisId)]);
    if (!patient || !anamnesis) return fail(c, 'Paciente ou anamnese não encontrados.', 404);
    const current: any = anamnesis.versions.at(-1);
    return c.json(await PatientAnamnesis.create({ patientId: body.patientId, anamnesisId: body.anamnesisId, followupId: body.followupId ?? null, version: current.version, schemaSnapshot: current.schema, required: body.required ?? anamnesis.requiredByDefault }), 201);
  })
  .post('/api/anamnesis-requests', async (c) => {
    const body = await c.req.json().catch(() => null), applied = await PatientAnamnesis.findById(body?.patientAnamnesisId);
    if (!applied) return fail(c, 'Anamnese aplicada não encontrada.', 404);
    const token = randomBytes(32).toString('base64url');
    applied.request = { tokenHash: hashToken(token), expiresAt: expiry(7), draft: {} }; await applied.save();
    return c.json({ id: applied.id, url: `/public/anamnesis/${token}`, expiresAt: applied.request.expiresAt }, 201);
  })
  .put('/api/anamnesis-requests/:id/refresh', async (c) => {
    const applied = await PatientAnamnesis.findById(c.req.param('id'));
    if (!applied?.request) return fail(c, 'Solicitação não encontrada.', 404);
    const token = randomBytes(32).toString('base64url'); applied.request.tokenHash = hashToken(token); applied.request.expiresAt = expiry(7); applied.request.submittedAt = undefined; applied.request.draft = {}; await applied.save();
    return c.json({ id: applied.id, url: `/public/anamnesis/${token}`, expiresAt: applied.request.expiresAt });
  })
  .get('/public/anamnesis/:token', async (c) => {
    const applied = await PatientAnamnesis.findOne({ 'request.tokenHash': hashToken(c.req.param('token')), 'request.expiresAt': { $gt: new Date() }, 'request.submittedAt': null }).populate('anamnesisId', 'title').lean() as any;
    return applied ? c.json({ title: applied.anamnesisId.title, schema: applied.schemaSnapshot, draft: applied.request?.draft ?? {} }) : fail(c, 'Link inválido, expirado ou já enviado.', 404);
  })
  .put('/public/anamnesis/:token/draft', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body?.draft)) return fail(c, 'Rascunho inválido.');
    const result = await PatientAnamnesis.updateOne({ 'request.tokenHash': hashToken(c.req.param('token')), 'request.expiresAt': { $gt: new Date() }, 'request.submittedAt': null }, { $set: { 'request.draft': body.draft } });
    return result.modifiedCount ? c.json({ saved: true }) : fail(c, 'Link inválido ou expirado.', 404);
  })
  .post('/public/anamnesis/:token/submit', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body?.answers)) return fail(c, 'Respostas inválidas.');
    const open = { 'request.tokenHash': hashToken(c.req.param('token')), 'request.expiresAt': { $gt: new Date() }, 'request.submittedAt': null };
    const found = await PatientAnamnesis.findOne(open).lean() as any;
    if (!found) return fail(c, 'Link inválido, expirado ou já enviado.', 409);
    const applied = await PatientAnamnesis.findOneAndUpdate({ _id: found._id, ...open }, { $set: { response: await buildResponse(found.anamnesisId, body.answers), 'request.submittedAt': new Date() } }, { new: true });
    return applied ? c.json({ submitted: true, validUntil: applied.response?.validUntil }, 201) : fail(c, 'Link inválido, expirado ou já enviado.', 409);
  })
  .post('/api/patient-anamneses/:id/answers', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body?.answers)) return fail(c, 'Respostas inválidas.');
    const applied = isValidObjectId(c.req.param('id')) ? await PatientAnamnesis.findOne({ _id: c.req.param('id'), 'response.submittedAt': null }).lean() as any : null;
    if (!applied) return fail(c, 'Anamnese não encontrada ou já respondida.', 404);
    await PatientAnamnesis.updateOne({ _id: applied._id }, { $set: { response: await buildResponse(applied.anamnesisId, body.answers) } });
    return c.json({ submitted: true }, 201);
  })
  .post('/api/anamnesis-responses/:id/notes', async (c) => {
    const body = await c.req.json().catch(() => null), applied = await PatientAnamnesis.findOne({ 'response._id': c.req.param('id') });
    if (!applied) return fail(c, 'Resposta não encontrada.', 404);
    if (typeof body?.content !== 'string' || !body.content.trim()) return fail(c, 'Observação obrigatória.');
    applied.notes.push({ content: body.content.trim(), createdAt: new Date() }); await applied.save(); return c.json(applied.notes.at(-1), 201);
  })
  .get('/api/patients/:id/relationship', async (c) => {
    if (!isValidObjectId(c.req.param('id'))) return fail(c, 'Paciente não encontrado.', 404);
    const patient = await Patient.findById(c.req.param('id')).lean(); if (!patient) return fail(c, 'Paciente não encontrado.', 404);
    const [followups, attendances, appointments] = await Promise.all([Followup.find({ patientId: patient._id }).lean(), Attendance.find({ patientId: patient._id }).sort({ performedAt: 1 }).lean(), Appointment.find({ patientId: patient._id }).lean()]);
    const payments: any[] = await Payment.find({ followupId: { $in: followups.map((followup: any) => followup._id) } }).lean();
    return c.json(buildRelationship(followups, attendances, payments, appointments));
  })
  .get('/api/patients/:id/history', async (c) => {
    if (!isValidObjectId(c.req.param('id'))) return fail(c, 'Paciente não encontrado.', 404);
    const patient = await Patient.findById(c.req.param('id')).lean(); if (!patient) return fail(c, 'Paciente não encontrado.', 404);
    const [followups, appointments, attendances, forms] = await Promise.all([Followup.find({ patientId: patient._id }).lean(), Appointment.find({ patientId: patient._id }).lean(), Attendance.find({ patientId: patient._id }).lean(), PatientAnamnesis.find({ patientId: patient._id }).populate('anamnesisId', 'title').lean()]);
    const followupIds = followups.map((p: any) => p._id), payments = await Payment.find({ followupId: { $in: followupIds } }).lean();
    const events: any[] = [...followups.map((p: any) => ({ type: 'followup', at: p.createdAt, title: `Acompanhamento: ${p.offerName}`, details: p })), ...appointments.map((a: any) => ({ type: 'appointment', at: a.startsAt, title: `Agendamento · ${appointmentStatusLabel[a.status] ?? a.status}`, details: a })), ...attendances.map((s: any) => ({ type: 'attendance', at: s.performedAt, title: `${s.procedureName} realizado`, details: s })), ...payments.map((p: any) => ({ type: 'payment', at: p.receivedAt, title: `Pagamento ${p.method}`, details: p })), ...forms.map((f: any) => ({ type: 'anamnesis', at: f.response?.submittedAt ?? f._id.getTimestamp(), title: `${f.anamnesisId?.title ?? 'Anamnese'} · ${f.response ? f.response.validUntil < new Date() ? 'vencida' : 'respondida' : 'pendente'}`, details: f }))];
    const pending = events.filter((event) => /pendente|vencida/.test(event.title) || (event.type === 'appointment' && event.details.status === 'planned'));
    return c.json({ patient, events: events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), pending });
  });
