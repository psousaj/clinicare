import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { isValidObjectId } from 'mongoose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Appointment, Anamnesis, Contract, PackageOffer, Patient, PatientAnamnesis, Payment, Plan, Procedure, Session } from '../../../packages/db/src/schema';
import { uploadUrl, uploadUrlForDocument, deleteObject } from './storage';

const fail = (c: Context, message: string, status: 400 | 404 | 409 | 503 = 400) => c.json({ error: message }, status);
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isRecord = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const validSchema = (value: unknown) => isRecord(value) && value.type === 'object' && isRecord(value.properties);
const expiry = (days: number) => new Date(Date.now() + days * 86400000);
const handleError = (c: Context, error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000) return c.json({ error: 'Este registro já existe.' }, 409);
  if (error instanceof Error && error.name === 'ValidationError') return c.json({ error: error.message }, 400);
  console.error(error);
  return c.json({ error: 'Ocorreu um erro inesperado.' }, 500);
};

export const app = new Hono()
  .use('/api/*', cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
  .onError((error, c) => handleError(c, error))
  .get('/api/health', async (c) => {
    try { await Patient.db?.db?.admin().ping(); return c.json({ status: 'ok', service: 'clinicare-api', database: 'connected' }); }
    catch { return c.json({ status: 'unavailable', service: 'clinicare-api', database: 'disconnected' }, 503); }
  })
  .get('/api/patients', async (c) => {
    const query = c.req.query('query');
    const filter = query ? { $or: [{ fullName: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { phone: { $regex: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } }] } : {};
    return c.json(await Patient.find(filter).sort({ createdAt: -1 }).lean());
  })
  .get('/api/patients/:id', async (c) => {
    if (!isValidObjectId(c.req.param('id'))) return fail(c, 'Paciente não encontrado.', 404);
    const patient = await Patient.findById(c.req.param('id')).lean();
    return patient ? c.json(patient) : fail(c, 'Paciente não encontrado.', 404);
  })
  .post('/api/patients', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.fullName !== 'string' || body.fullName.trim().length < 2) return fail(c, 'Nome completo é obrigatório.');
    if (body.phone != null && typeof body.phone !== 'string') return fail(c, 'Telefone inválido.');
    if (body.email != null && (typeof body.email !== 'string' || !validEmail(body.email))) return fail(c, 'E-mail inválido.');
    return c.json(await Patient.create({ fullName: body.fullName, phone: body.phone, email: body.email, notes: body.notes }), 201);
  })
  .put('/api/patients/:id', async (c) => {
    if (!isValidObjectId(c.req.param('id'))) return fail(c, 'Paciente não encontrado.', 404);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.fullName !== 'string' || body.fullName.trim().length < 2 || (body.email != null && (typeof body.email !== 'string' || !validEmail(body.email)))) return fail(c, 'Dados do paciente inválidos.');
    const patient = await Patient.findByIdAndUpdate(c.req.param('id'), { fullName: body.fullName, phone: body.phone, email: body.email, notes: body.notes }, { returnDocument: 'after', runValidators: true }).lean();
    return patient ? c.json(patient) : fail(c, 'Paciente não encontrado.', 404);
  })
  .get('/api/procedures', async (c) => c.json(await Procedure.find().sort({ createdAt: -1 }).lean()))
  .post('/api/procedures', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || body.name.trim().length < 2 || !Number.isInteger(body.baseSessions ?? 1) || (body.baseSessions ?? 1) < 1 || (body.durationMinutes != null && (!Number.isInteger(body.durationMinutes) || body.durationMinutes < 1)) || !Number.isSafeInteger(body.priceCents ?? 0) || (body.priceCents ?? 0) < 0 || !validSchema(body.sessionSchema ?? { type: 'object', properties: {} })) return fail(c, 'Dados ou formulário de procedimento inválidos.');
    return c.json(await Procedure.create({ ...body, sessionSchema: body.sessionSchema ?? { type: 'object', properties: {} }, versions: [{ version: 1, sessionSchema: body.sessionSchema ?? { type: 'object', properties: {} } }] }), 201);
  })
  .put('/api/procedures/:id', async (c) => {
    if (!isValidObjectId(c.req.param('id'))) return fail(c, 'Procedimento não encontrado.', 404);
    const procedure = await Procedure.findById(c.req.param('id'));
    if (!procedure) return fail(c, 'Procedimento não encontrado.', 404);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || !validSchema(body.sessionSchema ?? procedure.sessionSchema)) return fail(c, 'Dados de procedimento inválidos.');
    const versions = procedure.versions.map((version: any) => version.toObject());
    if (JSON.stringify(body.sessionSchema ?? procedure.sessionSchema) !== JSON.stringify(procedure.sessionSchema)) versions.push({ version: (versions.at(-1)?.version ?? 0) + 1, sessionSchema: body.sessionSchema, createdAt: new Date() });
    Object.assign(procedure, body);
    procedure.set('versions', versions);
    procedure.markModified('versions');
    if (body.sessionSchema !== undefined) procedure.markModified('sessionSchema');
    await procedure.save(); return c.json(procedure.toObject());
  })
  .get('/api/anamneses', async (c) => c.json(await Anamnesis.find().sort({ createdAt: -1 }).lean()))
  .post('/api/anamneses', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.title !== 'string' || body.title.trim().length < 2 || !validSchema(body.schema)) return fail(c, 'Informe o nome e um JSON Schema válido.');
    return c.json(await Anamnesis.create({ title: body.title, versions: [{ version: 1, schema: body.schema }], procedureIds: body.procedureIds ?? [], requiredByDefault: body.requiredByDefault !== false }), 201);
  })
  .post('/api/anamneses/:id/versions', async (c) => {
    const anamnesis = await Anamnesis.findById(c.req.param('id'));
    if (!anamnesis) return fail(c, 'Anamnese não encontrada.', 404);
    const body = await c.req.json().catch(() => null);
    const old = Number.isInteger(body?.restoreVersion) ? anamnesis.versions.find((version: any) => version.version === body.restoreVersion) : null;
    const schema = old?.schema ?? body?.schema;
    if (!validSchema(schema)) return fail(c, 'JSON Schema inválido.');
    anamnesis.versions.push({ version: (anamnesis.versions.at(-1)?.version ?? 0) + 1, schema, createdAt: new Date() }); await anamnesis.save();
    return c.json(anamnesis.versions.at(-1), 201);
  })
  .put('/api/anamneses/:id/associations', async (c) => {
    const anamnesis = await Anamnesis.findById(c.req.param('id'));
    const body = await c.req.json().catch(() => null);
    if (!anamnesis) return fail(c, 'Anamnese não encontrada.', 404);
    if (!Array.isArray(body?.procedures)) return fail(c, 'Associações inválidas.');
    for (const item of body.procedures) if (!await Procedure.exists({ _id: item.procedureId })) return fail(c, 'Procedimento não encontrado.', 404);
    anamnesis.procedureIds = body.procedures.map((item: any) => item.procedureId);
    anamnesis.requiredByDefault = body.procedures.some((item: any) => item.required); await anamnesis.save();
    return c.json(anamnesis.toObject());
  })
  .get('/api/packages', async (c) => c.json(await PackageOffer.find().populate('items.procedureId').sort({ createdAt: -1 }).lean()))
  .post('/api/packages', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || !Number.isSafeInteger(body.priceCents) || !Array.isArray(body.items) || !body.items.length) return fail(c, 'Pacote requer nome, preço e procedimentos.');
    for (const item of body.items) if (!await Procedure.exists({ _id: item.procedureId })) return fail(c, 'Procedimento não encontrado.', 404);
    return c.json(await PackageOffer.create(body), 201);
  })
  .get('/api/contracts', async (c) => c.json(await Contract.find().sort({ createdAt: -1 }).lean()))
  .post('/api/contracts/upload-url', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (typeof body?.fileName !== 'string' || !body.fileName.toLowerCase().endsWith('.docx') || !Number.isInteger(body.size) || body.size < 1 || body.size > 15_000_000) return fail(c, 'Arquivo DOCX inválido ou maior que 15 MB.');
    const key = `documents/${randomUUID()}.docx`;
    try { return c.json({ uploadUrl: await uploadUrlForDocument(key), objectKey: key, expiresInSeconds: 300 }); }
    catch { return fail(c, 'R2 não configurado.', 503); }
  })
  .post('/api/contracts', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.title !== 'string' || !['standard', 'procedure', 'package'].includes(body.kind)) return fail(c, 'Contrato inválido.');
    return c.json(await Contract.create({ ...body, versions: [{ version: 1, content: body.content ?? null, createdAt: new Date() }] }), 201);
  })
  .post('/api/contracts/:id/versions', async (c) => {
    const contract = await Contract.findById(c.req.param('id'));
    if (!contract) return fail(c, 'Contrato não encontrado.', 404);
    const body = await c.req.json().catch(() => null), source = contract.versions.find((v: any) => v.version === body?.restoreVersion);
    const content = source?.content ?? body?.content;
    if (typeof content !== 'string') return fail(c, 'Conteúdo do contrato inválido.');
    contract.versions.push({ version: (contract.versions.at(-1)?.version ?? 0) + 1, content, createdAt: new Date() }); await contract.save();
    return c.json(contract.versions.at(-1), 201);
  })
  .post('/api/plans', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !isValidObjectId(body.patientId) || !['procedure', 'package'].includes(body.offerType) || !isValidObjectId(body.offerId) || !Number.isSafeInteger(body.priceCents) || body.priceCents < 0) return fail(c, 'Paciente, oferta e preço válido são obrigatórios.');
    const patient = await Patient.exists({ _id: body.patientId }); if (!patient) return fail(c, 'Paciente não encontrado.', 404);
    let items: any[] = [], name = '', priceCents = Number(body.priceCents);
    if (body.offerType === 'procedure') { const procedure = await Procedure.findById(body.offerId).lean(); if (!procedure || !procedure.active) return fail(c, 'Procedimento não encontrado.', 404); name = procedure.name; priceCents = procedure.priceCents; items = [{ procedureId: procedure._id, procedureName: procedure.name, sessionsTotal: procedure.baseSessions, sessionSchema: procedure.sessionSchema, priceCents: procedure.priceCents, anamneses: [] }]; }
    else { const pack = await PackageOffer.findById(body.offerId).populate('items.procedureId').lean() as any; if (!pack || !pack.active) return fail(c, 'Pacote não encontrado.', 404); const today = new Date(); if ((pack.validFrom && pack.validFrom > today) || (pack.validUntil && pack.validUntil < today)) return fail(c, 'Pacote fora da validade.', 409); name = pack.name; priceCents = pack.promotionalPriceCents ?? pack.priceCents; items = pack.items.map((item: any) => ({ procedureId: item.procedureId._id, procedureName: item.procedureId.name, sessionsTotal: item.sessionsOverride ?? item.procedureId.baseSessions, sessionSchema: item.procedureId.sessionSchema, priceCents: item.priceOverrideCents ?? item.procedureId.priceCents, anamneses: [] })); }
    const anamneses = await Anamnesis.find({ procedureIds: { $in: items.map((item) => item.procedureId) }, active: true }).lean();
    for (const item of items) item.anamneses = anamneses.map((a: any) => ({ anamnesisId: a._id, required: a.requiredByDefault, version: a.versions.at(-1)?.version, schemaSnapshot: a.versions.at(-1)?.schema }));
    const contracts = await Contract.find({ active: true, $or: [{ kind: 'standard' }, { kind: 'procedure', procedureId: { $in: items.map((item) => item.procedureId) } }, { kind: 'package', packageId: body.offerId }] }).lean();
    return c.json(await Plan.create({ patientId: body.patientId, offerType: body.offerType, offerId: body.offerId, offerName: name, priceCents, items, contracts: contracts.map((contract: any) => ({ contractId: contract._id, title: contract.title, version: contract.versions.at(-1)?.version, contentSnapshot: contract.versions.at(-1)?.content, objectKey: contract.versions.at(-1)?.sourceObjectKey })) }), 201);
  })
  .get('/api/plans', async (c) => {
    const plans = await Plan.find().populate('patientId', 'fullName').sort({ createdAt: -1 }).lean();
    const ids = plans.map((plan: any) => plan._id);
    const payments = await Payment.find({ planId: { $in: ids } }).lean();
    return c.json(plans.map((plan: any) => ({ ...plan, payments: payments.filter((payment: any) => String(payment.planId) === String(plan._id)) })));
  })
  .post('/api/payments', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !isValidObjectId(body.planId) || !Number.isSafeInteger(body.amountCents) || body.amountCents <= 0 || !['cash', 'pix', 'credit_card'].includes(body.method)) return fail(c, 'Pagamento inválido.');
    if (!await Plan.exists({ _id: body.planId })) return fail(c, 'Plano não encontrado.', 404);
    return c.json(await Payment.create(body), 201);
  })
  .get('/api/appointments', async (c) => {
    const from = c.req.query('from') ? new Date(c.req.query('from')!) : new Date(Date.now() - 7 * 86400000), to = c.req.query('to') ? new Date(c.req.query('to')!) : expiry(14);
    return c.json(await Appointment.find({ startsAt: { $gte: from, $lt: to } }).populate('patientId', 'fullName').sort({ startsAt: 1 }).lean());
  })
  .post('/api/appointments', async (c) => {
    const body = await c.req.json().catch(() => null), startsAt = new Date(body?.startsAt), endsAt = new Date(body?.endsAt);
    if (!body || !isValidObjectId(body.patientId) || !Array.isArray(body.planItemIds) || !body.planItemIds.length || endsAt <= startsAt) return fail(c, 'Agendamento inválido.');
    if (!await Patient.exists({ _id: body.patientId })) return fail(c, 'Paciente não encontrado.', 404);
    for (const itemId of body.planItemIds) if (!await Plan.exists({ 'items._id': itemId, patientId: body.patientId })) return fail(c, 'Procedimento não pertence a plano deste paciente.', 404);
    return c.json(await Appointment.create({ ...body, startsAt, endsAt }), 201);
  })
  .patch('/api/appointments/:id', async (c) => {
    const body = await c.req.json().catch(() => null);
    const result = await Appointment.findByIdAndUpdate(c.req.param('id'), body, { returnDocument: 'after', runValidators: true }).lean();
    return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404);
  })
  .post('/api/sessions', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !isValidObjectId(body.planId) || !isValidObjectId(body.planItemId)) return fail(c, 'Plano e procedimento contratado são obrigatórios.');
    const plan = await Plan.findOne({ _id: body.planId, 'items._id': body.planItemId });
    if (!plan) return fail(c, 'Procedimento contratado não encontrado.', 404);
    const item: any = plan.items.id(body.planItemId);
    if (item.sessionsPerformed >= item.sessionsTotal) return fail(c, 'Todas as sessões já foram realizadas.', 409);
    const session = await Session.create({ patientId: plan.patientId, planId: plan._id, planItemId: item._id, appointmentId: body.appointmentId ?? null, procedureName: item.procedureName, performedAt: body.performedAt ?? new Date(), data: body.data ?? {}, schemaSnapshot: item.sessionSchema, notes: body.notes ?? null });
    item.sessionsPerformed += 1;
    try { await plan.save(); } catch (error) { await Session.deleteOne({ _id: session._id }); throw error; }
    return c.json(session, 201);
  })
  .get('/api/sessions', async (c) => c.json(await Session.find().populate('patientId', 'fullName').sort({ performedAt: -1 }).lean()))
  .post('/api/uploads/presign', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.contentType !== 'string' || !/^image\/(jpeg|png|webp)$/.test(body.contentType) || !Number.isInteger(body.size) || body.size < 1 || body.size > 10_000_000) return fail(c, 'Imagem inválida ou maior que 10 MB.');
    const key = `uploads/${randomUUID()}`;
    try { return c.json({ uploadUrl: await uploadUrl(key, body.contentType), objectKey: key, expiresInSeconds: 300 }); }
    catch { return c.json({ error: 'R2 não configurado.' }, 503); }
  })
  .post('/api/sessions/:id/photos', async (c) => {
    const body = await c.req.json().catch(() => null), session = await Session.findById(c.req.param('id'));
    if (!session) return fail(c, 'Sessão não encontrada.', 404);
    if (!body || typeof body.objectKey !== 'string' || !/^uploads\/[\w-]+$/.test(body.objectKey) || !['before', 'during', 'after'].includes(body.phase)) return fail(c, 'Foto inválida.');
    session.photos.push(body); await session.save(); return c.json(session.photos.at(-1), 201);
  })
  .delete('/api/sessions/:id/photos/:photoId', async (c) => {
    const session = await Session.findById(c.req.param('id'));
    if (!session) return fail(c, 'Sessão não encontrada.', 404);
    const photo = session.photos.id(c.req.param('photoId'));
    if (!photo) return fail(c, 'Foto não encontrada.', 404);
    try { await deleteObject(photo.objectKey); } catch (error) { console.error(error); }
    photo.deleteOne(); await session.save(); return c.json({ deleted: true });
  })
  .post('/api/patient-anamneses', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !isValidObjectId(body.patientId) || !isValidObjectId(body.anamnesisId)) return fail(c, 'Paciente e anamnese são obrigatórios.');
    const [patient, anamnesis] = await Promise.all([Patient.exists({ _id: body.patientId }), Anamnesis.findById(body.anamnesisId)]);
    if (!patient || !anamnesis) return fail(c, 'Paciente ou anamnese não encontrados.', 404);
    const current: any = anamnesis.versions.at(-1);
    return c.json(await PatientAnamnesis.create({ patientId: body.patientId, anamnesisId: body.anamnesisId, planId: body.planId ?? null, version: current.version, schemaSnapshot: current.schema, required: body.required ?? anamnesis.requiredByDefault }), 201);
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
    const applied = await PatientAnamnesis.findOneAndUpdate({ 'request.tokenHash': hashToken(c.req.param('token')), 'request.expiresAt': { $gt: new Date() }, 'request.submittedAt': null }, { $set: { response: { answers: body.answers, submittedAt: new Date(), validUntil: expiry(365) }, 'request.submittedAt': new Date() } }, { new: true });
    return applied ? c.json({ submitted: true, validUntil: applied.response?.validUntil }, 201) : fail(c, 'Link inválido, expirado ou já enviado.', 409);
  })
  .post('/api/anamnesis-responses/:id/notes', async (c) => {
    const body = await c.req.json().catch(() => null), applied = await PatientAnamnesis.findOne({ 'response._id': c.req.param('id') });
    if (!applied) return fail(c, 'Resposta não encontrada.', 404);
    if (typeof body?.content !== 'string' || !body.content.trim()) return fail(c, 'Observação obrigatória.');
    applied.notes.push({ content: body.content.trim(), createdAt: new Date() }); await applied.save(); return c.json(applied.notes.at(-1), 201);
  })
  .get('/api/patients/:id/history', async (c) => {
    if (!isValidObjectId(c.req.param('id'))) return fail(c, 'Paciente não encontrado.', 404);
    const patient = await Patient.findById(c.req.param('id')).lean(); if (!patient) return fail(c, 'Paciente não encontrado.', 404);
    const [plans, appointments, sessions, forms] = await Promise.all([Plan.find({ patientId: patient._id }).lean(), Appointment.find({ patientId: patient._id }).lean(), Session.find({ patientId: patient._id }).lean(), PatientAnamnesis.find({ patientId: patient._id }).populate('anamnesisId', 'title').lean()]);
    const planIds = plans.map((p: any) => p._id), payments = await Payment.find({ planId: { $in: planIds } }).lean();
    const events: any[] = [...plans.map((p: any) => ({ type: 'plan', at: p.createdAt, title: `Contratação: ${p.offerName}`, details: p })), ...appointments.map((a: any) => ({ type: 'appointment', at: a.startsAt, title: `Agendamento · ${a.status}`, details: a })), ...sessions.map((s: any) => ({ type: 'session', at: s.performedAt, title: `${s.procedureName} realizado`, details: s })), ...payments.map((p: any) => ({ type: 'payment', at: p.receivedAt, title: `Pagamento ${p.method}`, details: p })), ...forms.map((f: any) => ({ type: 'anamnesis', at: f.response?.submittedAt ?? f.createdAt, title: `${f.anamnesisId?.title ?? 'Anamnese'} · ${f.response ? f.response.validUntil < new Date() ? 'vencida' : 'respondida' : 'pendente'}`, details: f }))];
    const pending = events.filter((event) => /pendente|vencida|planned/.test(event.title));
    return c.json({ patient, events: events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), pending });
  });
