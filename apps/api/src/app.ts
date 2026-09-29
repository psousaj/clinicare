import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { isValidObjectId } from 'mongoose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Appointment, Anamnesis, Contract, Combo, Patient, PatientAnamnesis, Payment, Attendance, Plan, Procedure, Session } from '@clinicare/db';
import { buildRelationship } from './relationship';
import { uploadUrl, uploadUrlForDocument, downloadUrl, deleteObject } from './storage';

const fail = (c: Context, message: string, status: 400 | 404 | 409 | 503 = 400) => c.json({ error: message }, status);
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isRecord = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const validSchema = (value: unknown) => isRecord(value) && value.type === 'object' && isRecord(value.properties);
const validDuration = (value: unknown) => Number.isInteger(value) && (value as number) > 0 && (value as number) <= 1440;
const expiry = (days: number) => new Date(Date.now() + days * 86400000);
const handleError = (c: Context, error: unknown) => {
  if (error && typeof error === 'object' && 'code' in error && (error as { code: number }).code === 11000) return c.json({ error: 'Este registro já existe.' }, 409);
  if (error instanceof Error && error.name === 'ValidationError') return c.json({ error: error.message }, 400);
  console.error(error);
  return c.json({ error: 'Ocorreu um erro inesperado.' }, 500);
};

type OfferItem = { procedureId: unknown; procedureName: string; sessionsTotal: number; sessionSchema: unknown; priceCents: number; anamneses: unknown[] };
type ResolvedOffer = { name: string; priceCents: number; items: OfferItem[]; comboIds: unknown[]; contractIds: unknown[]; requireNewAnamnesis: boolean; validUntil: Date | null };
const procedureItem = (procedure: any, override: { sessions?: number | null; priceCents?: number | null } = {}): OfferItem => ({ procedureId: procedure._id, procedureName: procedure.name, sessionsTotal: override.sessions ?? procedure.baseSessions, sessionSchema: procedure.sessionSchema, priceCents: override.priceCents ?? procedure.priceCents, anamneses: [] });
const comboAvailable = (combo: any) => { const today = new Date(); return combo.active && !(combo.validFrom && combo.validFrom > today) && !(combo.validUntil && combo.validUntil < today); };
// Valor integral = soma de (preço do procedimento × sessões). Combo nunca abaixo dele; promoção nunca acima do preço do combo.
async function comboPriceError(items: any[], priceCents: number, promotionalPriceCents: number | null) {
  const procedures = await Procedure.find({ _id: { $in: items.map((item) => item.procedureId?._id ?? item.procedureId) } }).lean();
  const integral = items.reduce((total, item) => {
    const procedure: any = procedures.find((candidate: any) => String(candidate._id) === String(item.procedureId?._id ?? item.procedureId));
    return total + (item.priceOverrideCents ?? procedure?.priceCents ?? 0) * (item.sessionsOverride ?? procedure?.baseSessions ?? 1);
  }, 0);
  if (priceCents < integral) return `O preço do combo não pode ser menor que o valor integral dos procedimentos (${(integral / 100).toFixed(2).replace('.', ',')}).`;
  if (promotionalPriceCents != null && promotionalPriceCents > priceCents) return 'O preço promocional não pode ser maior que o preço do combo.';
  return null;
}
const comboItems = (combo: any) => combo.items.map((item: any) => procedureItem(item.procedureId, { sessions: item.sessionsOverride, priceCents: item.priceOverrideCents }));
async function resolveOffer(offerType: string, offerId: string): Promise<ResolvedOffer | { error: string; status: 404 | 409 }> {
  if (offerType === 'procedure') {
    const procedure = await Procedure.findById(offerId).lean();
    if (!procedure || !procedure.active) return { error: 'Procedimento não encontrado.', status: 404 };
    return { name: procedure.name, priceCents: procedure.priceCents, items: [procedureItem(procedure)], comboIds: [], contractIds: [], requireNewAnamnesis: procedure.requireNewAnamnesis === true, validUntil: null };
  }
  if (offerType === 'combo') {
    const combo = await Combo.findById(offerId).populate('items.procedureId').lean() as any;
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
      const procedure = await Procedure.findById(entry.offerId).lean();
      if (procedure?.active) { items.push(procedureItem(procedure)); requireNewAnamnesis ||= procedure.requireNewAnamnesis === true; }
    } else {
      const combo = await Combo.findById(entry.offerId).populate('items.procedureId').lean() as any;
      if (combo?.active) { items.push(...comboItems(combo)); comboIds.push(combo._id); requireNewAnamnesis ||= combo.requireNewAnamnesis === true; }
    }
  }
  if (!items.length) return { error: 'Plano sem procedimentos disponíveis.', status: 409 };
  return { name: plan.name, priceCents: plan.priceCents, items, comboIds, contractIds: plan.contractIds, requireNewAnamnesis, validUntil: plan.validityDays ? expiry(plan.validityDays) : null };
}
const monthsFromNow = (months: number) => { const date = new Date(); date.setMonth(date.getMonth() + months); return date; };
const buildResponse = async (anamnesisId: unknown, answers: Record<string, unknown>) => ({ answers, submittedAt: new Date(), validUntil: monthsFromNow(((await Anamnesis.findById(anamnesisId).lean()) as any)?.validityMonths ?? 12) });

const appointmentStatusLabel: Record<string, string> = { planned: 'agendado', confirmed: 'confirmado', rescheduled: 'remarcado', cancelled: 'cancelado', no_show: 'faltou' };
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
    if (!isRecord(body)) return fail(c, 'Dados de procedimento inválidos.');
    const has = (key: string) => body[key] !== undefined;
    if ((has('name') && (typeof body.name !== 'string' || body.name.trim().length < 2)) || (has('baseSessions') && (!Number.isInteger(body.baseSessions) || body.baseSessions < 1)) || (body.durationMinutes != null && (!Number.isInteger(body.durationMinutes) || body.durationMinutes < 1))
      || (has('priceCents') && (!Number.isSafeInteger(body.priceCents) || body.priceCents < 0)) || (has('active') && typeof body.active !== 'boolean') || (has('requireNewAnamnesis') && typeof body.requireNewAnamnesis !== 'boolean') || (has('sessionSchema') && !validSchema(body.sessionSchema))) return fail(c, 'Dados de procedimento inválidos.');
    if (has('sessionSchema') && JSON.stringify(body.sessionSchema) !== JSON.stringify(procedure.sessionSchema)) {
      const versions = procedure.versions.map((version: any) => version.toObject());
      versions.push({ version: (versions.at(-1)?.version ?? 0) + 1, sessionSchema: body.sessionSchema, createdAt: new Date() });
      procedure.set('versions', versions);
      procedure.markModified('versions');
      procedure.set('sessionSchema', body.sessionSchema);
      procedure.markModified('sessionSchema');
    }
    for (const key of ['name', 'description', 'baseSessions', 'durationMinutes', 'priceCents', 'active', 'requireNewAnamnesis']) if (has(key)) procedure.set(key, body[key]);
    await procedure.save(); return c.json(procedure.toObject());
  })
  .get('/api/anamneses', async (c) => c.json(await Anamnesis.find().sort({ createdAt: -1 }).lean()))
  .post('/api/anamneses', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.title !== 'string' || body.title.trim().length < 2 || !validSchema(body.schema)) return fail(c, 'Informe o nome e ao menos um campo válido.');
    return c.json(await Anamnesis.create({ title: body.title, versions: [{ version: 1, schema: body.schema }], procedureIds: body.procedureIds ?? [], requiredByDefault: body.requiredByDefault !== false, validityMonths: Number.isInteger(body.validityMonths) && body.validityMonths > 0 ? body.validityMonths : 12 }), 201);
  })
  .patch('/api/anamneses/:id', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!isValidObjectId(c.req.param('id'))) return fail(c, 'Formulário de anamnese não encontrado.', 404);
    if (typeof body?.title !== 'string' || body.title.trim().length < 2) return fail(c, 'Informe o nome do formulário.');
    if (body.validityMonths !== undefined && (!Number.isInteger(body.validityMonths) || body.validityMonths < 1)) return fail(c, 'Validade deve ser um número inteiro de meses.');
    const anamnesis = await Anamnesis.findByIdAndUpdate(c.req.param('id'), { title: body.title.trim(), ...(body.validityMonths !== undefined && { validityMonths: body.validityMonths }) }, { new: true, runValidators: true }).lean();
    return anamnesis ? c.json(anamnesis) : fail(c, 'Formulário de anamnese não encontrado.', 404);
  })
  .post('/api/anamneses/:id/versions', async (c) => {
    const anamnesis = isValidObjectId(c.req.param('id')) ? await Anamnesis.findById(c.req.param('id')) : null;
    if (!anamnesis) return fail(c, 'Formulário de anamnese não encontrado.', 404);
    const body = await c.req.json().catch(() => null);
    const restoring = Number.isInteger(body?.restoreVersion);
    const source = restoring ? anamnesis.versions.find((version: any) => version.version === body.restoreVersion) : null;
    if (restoring && !source) return fail(c, 'Versão não encontrada.', 404);
    const schema = source?.schema ?? body?.schema;
    if (!validSchema(schema)) return fail(c, 'Formulário inválido.');
    anamnesis.versions.push({ version: (anamnesis.versions.at(-1)?.version ?? 0) + 1, schema, origin: source ? 'restored' : 'edited', restoredFromVersion: source?.version ?? null, createdAt: new Date() }); await anamnesis.save();
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
  .get('/api/combos', async (c) => c.json(await Combo.find().populate('items.procedureId').sort({ createdAt: -1 }).lean()))
  .post('/api/combos', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || !Number.isSafeInteger(body.priceCents) || !Array.isArray(body.items) || !body.items.length) return fail(c, 'Combo requer nome, preço e procedimentos.');
    if (body.promotionalPriceCents != null && (!Number.isSafeInteger(body.promotionalPriceCents) || body.promotionalPriceCents < 0 || !body.validUntil)) return fail(c, 'Combo promocional exige preço promocional e validade.');
    for (const item of body.items) if (!await Procedure.exists({ _id: item.procedureId })) return fail(c, 'Procedimento não encontrado.', 404);
    const priceError = await comboPriceError(body.items, body.priceCents, body.promotionalPriceCents ?? null);
    if (priceError) return fail(c, priceError);
    return c.json(await Combo.create(body), 201);
  })
  .put('/api/combos/:id', async (c) => {
    const combo = isValidObjectId(c.req.param('id')) ? await Combo.findById(c.req.param('id')) : null;
    if (!combo) return fail(c, 'Combo não encontrado.', 404);
    const body = await c.req.json().catch(() => null);
    if (!isRecord(body)) return fail(c, 'Dados do combo inválidos.');
    const has = (key: string) => body[key] !== undefined;
    if ((has('name') && (typeof body.name !== 'string' || body.name.trim().length < 2)) || (has('priceCents') && (!Number.isSafeInteger(body.priceCents) || body.priceCents < 0)) || (has('active') && typeof body.active !== 'boolean') || (has('requireNewAnamnesis') && typeof body.requireNewAnamnesis !== 'boolean')
      || (has('items') && (!Array.isArray(body.items) || !body.items.length || body.items.some((item: any) => !isRecord(item) || !isValidObjectId(item.procedureId) || (item.sessionsOverride != null && (!Number.isInteger(item.sessionsOverride) || item.sessionsOverride < 1)))))) return fail(c, 'Dados do combo inválidos.');
    const promotional = has('promotionalPriceCents') ? body.promotionalPriceCents : combo.promotionalPriceCents, until = has('validUntil') ? body.validUntil : combo.validUntil;
    if (promotional != null && (!Number.isSafeInteger(promotional) || promotional < 0 || !until)) return fail(c, 'Combo promocional exige preço promocional e validade.');
    if (has('items')) for (const item of body.items) if (!await Procedure.exists({ _id: item.procedureId })) return fail(c, 'Procedimento não encontrado.', 404);
    if (has('items') || has('priceCents') || has('promotionalPriceCents')) {
      const priceError = await comboPriceError(has('items') ? body.items : combo.items, has('priceCents') ? body.priceCents : combo.priceCents, promotional ?? null);
      if (priceError) return fail(c, priceError);
    }
    for (const key of ['name', 'description', 'priceCents', 'promotionalPriceCents', 'validFrom', 'validUntil', 'active', 'requireNewAnamnesis', 'items']) if (has(key)) combo.set(key, body[key]);
    await combo.save(); return c.json(combo.toObject());
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
    if (!body || typeof body.title !== 'string' || !['standard', 'procedure', 'combo'].includes(body.kind)) return fail(c, 'Contrato inválido.');
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
  .get('/api/plans', async (c) => c.json(await Plan.find().sort({ createdAt: -1 }).lean()))
  .post('/api/plans', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.name !== 'string' || body.name.trim().length < 2 || !Number.isSafeInteger(body.priceCents) || body.priceCents < 0 || !Array.isArray(body.items) || !body.items.length) return fail(c, 'Plano requer nome, preço e ao menos um procedimento ou combo.');
    for (const field of ['durationDays', 'validityDays']) if (body[field] != null && (!Number.isInteger(body[field]) || body[field] < 1)) return fail(c, 'Duração e validade devem ser dias inteiros.');
    for (const item of body.items) {
      const model = item?.offerType === 'combo' ? Combo : item?.offerType === 'procedure' ? Procedure : null;
      if (!model || !isValidObjectId(item.offerId) || !await model.exists({ _id: item.offerId })) return fail(c, 'Procedimento ou combo do plano não encontrado.', 404);
    }
    const contractIds = body.contractIds ?? [];
    if (!Array.isArray(contractIds) || (contractIds.length && await Contract.countDocuments({ _id: { $in: contractIds } }) !== contractIds.length)) return fail(c, 'Contrato não encontrado.', 404);
    return c.json(await Plan.create({ name: body.name, description: body.description, priceCents: body.priceCents, durationDays: body.durationDays, validityDays: body.validityDays, items: body.items.map((item: any) => ({ offerType: item.offerType, offerId: item.offerId })), contractIds, requireNewAnamnesis: body.requireNewAnamnesis === true }), 201);
  })
  .post('/api/attendances', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !isValidObjectId(body.patientId) || !['procedure', 'combo', 'plan'].includes(body.offerType) || !isValidObjectId(body.offerId)) return fail(c, 'Paciente e oferta são obrigatórios.');
    if (!await Patient.exists({ _id: body.patientId })) return fail(c, 'Paciente não encontrado.', 404);
    const offer = await resolveOffer(body.offerType, body.offerId);
    if ('error' in offer) return fail(c, offer.error, offer.status);
    const procedureIds = offer.items.map((item) => item.procedureId);
    const [contracts, forms] = await Promise.all([
      Contract.find({ active: true, $or: [{ kind: 'standard' }, { kind: 'procedure', procedureId: { $in: procedureIds } }, { kind: 'combo', comboId: { $in: offer.comboIds } }, { _id: { $in: offer.contractIds } }] }).lean(),
      Anamnesis.find({ procedureIds: { $in: procedureIds }, active: true, requiredByDefault: true }).lean(),
    ]);
    for (const item of offer.items) item.anamneses = forms.filter((form: any) => form.procedureIds.some((id: any) => String(id) === String(item.procedureId))).map((form: any) => ({ anamnesisId: form._id, required: true, version: form.versions.at(-1)?.version, schemaSnapshot: form.versions.at(-1)?.schema }));
    const attendance = await Attendance.create({ patientId: body.patientId, offerType: body.offerType, offerId: body.offerId, offerName: offer.name, priceCents: offer.priceCents, validUntil: offer.validUntil, items: offer.items, contracts: contracts.map((contract: any) => ({ contractId: contract._id, title: contract.title, version: contract.versions.at(-1)?.version, contentSnapshot: contract.versions.at(-1)?.content, objectKey: contract.versions.at(-1)?.sourceObjectKey })) });
    const now = new Date();
    for (const form of forms as any[]) {
      const reusable = offer.requireNewAnamnesis ? null : await PatientAnamnesis.exists({ patientId: body.patientId, anamnesisId: form._id, 'response.validUntil': { $gt: now } });
      if (reusable) continue;
      const current = form.versions.at(-1);
      await PatientAnamnesis.create({ patientId: body.patientId, anamnesisId: form._id, attendanceId: attendance._id, version: current.version, schemaSnapshot: current.schema, required: true });
    }
    return c.json(attendance, 201);
  })
  .get('/api/attendances', async (c) => {
    const attendances = await Attendance.find().populate('patientId', 'fullName').sort({ createdAt: -1 }).lean();
    const ids = attendances.map((attendance: any) => attendance._id);
    const [payments, forms] = await Promise.all([Payment.find({ attendanceId: { $in: ids } }).lean(), PatientAnamnesis.find({ attendanceId: { $in: ids } }).populate('anamnesisId', 'title validityMonths').lean()]);
    return c.json(attendances.map((attendance: any) => {
      const anamneses = forms.filter((form: any) => String(form.attendanceId) === String(attendance._id)).map((form: any) => ({ id: form._id, title: form.anamnesisId?.title ?? 'Anamnese', required: form.required, schemaSnapshot: form.schemaSnapshot, answered: !!form.response?.submittedAt, answers: form.response?.answers ?? null, submittedAt: form.response?.submittedAt ?? null, validUntil: form.response?.validUntil ?? null }));
      return { ...attendance, payments: payments.filter((payment: any) => String(payment.attendanceId) === String(attendance._id)), anamneses, blocked: anamneses.some((form: any) => form.required && !form.answered) };
    }));
  })
  .post('/api/payments', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !isValidObjectId(body.attendanceId) || !Number.isSafeInteger(body.amountCents) || body.amountCents <= 0 || !['cash', 'pix', 'credit_card'].includes(body.method)) return fail(c, 'Pagamento inválido.');
    if (!await Attendance.exists({ _id: body.attendanceId })) return fail(c, 'Atendimento não encontrado.', 404);
    return c.json(await Payment.create(body), 201);
  })
  .get('/api/appointments', async (c) => {
    const from = c.req.query('from') ? new Date(c.req.query('from')!) : new Date(Date.now() - 7 * 86400000), to = c.req.query('to') ? new Date(c.req.query('to')!) : expiry(14);
    return c.json(await Appointment.find({ startsAt: { $gte: from, $lt: to } }).populate('patientId', 'fullName').sort({ startsAt: 1 }).lean());
  })
  .post('/api/appointments', async (c) => {
    const body = await c.req.json().catch(() => null), startsAt = new Date(body?.startsAt), endsAt = new Date(body?.endsAt);
    if (!body || !isValidObjectId(body.patientId) || !Array.isArray(body.attendanceItemIds) || !body.attendanceItemIds.length || endsAt <= startsAt) return fail(c, 'Agendamento inválido.');
    if (!await Patient.exists({ _id: body.patientId })) return fail(c, 'Paciente não encontrado.', 404);
    for (const itemId of body.attendanceItemIds) if (!await Attendance.exists({ 'items._id': itemId, patientId: body.patientId })) return fail(c, 'Procedimento não pertence a um atendimento deste paciente.', 404);
    const owners = await Attendance.find({ 'items._id': { $in: body.attendanceItemIds }, patientId: body.patientId }).select('_id').lean();
    const pending = await PatientAnamnesis.find({ attendanceId: { $in: owners.map((owner: any) => owner._id) }, required: true, 'response.submittedAt': null }).populate('anamnesisId', 'title').lean();
    if (pending.length) return fail(c, `Anamnese pendente: ${pending.map((form: any) => form.anamnesisId?.title ?? 'Anamnese').join(', ')}. Conclua antes de agendar.`, 409);
    return c.json(await Appointment.create({ ...body, startsAt, endsAt }), 201);
  })
  .patch('/api/appointments/:id', async (c) => {
    const body = await c.req.json().catch(() => null);
    const result = await Appointment.findByIdAndUpdate(c.req.param('id'), body, { returnDocument: 'after', runValidators: true }).lean();
    return result ? c.json(result) : fail(c, 'Agendamento não encontrado.', 404);
  })
  .delete('/api/appointments/:id', async (c) => {
    const result = isValidObjectId(c.req.param('id')) ? await Appointment.findByIdAndDelete(c.req.param('id')).lean() : null;
    return result ? c.json({ deleted: true }) : fail(c, 'Agendamento não encontrado.', 404);
  })
  .post('/api/sessions', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !isValidObjectId(body.attendanceId) || !isValidObjectId(body.attendanceItemId)) return fail(c, 'Atendimento e procedimento são obrigatórios.');
    const attendance = await Attendance.findOne({ _id: body.attendanceId, 'items._id': body.attendanceItemId });
    if (!attendance) return fail(c, 'Procedimento contratado não encontrado.', 404);
    const item: any = attendance.items.id(body.attendanceItemId);
    if (item.sessionsPerformed >= item.sessionsTotal) return fail(c, 'Todas as sessões já foram realizadas.', 409);
    if (body.durationMinutes != null && !validDuration(body.durationMinutes)) return fail(c, 'Duração inválida.');
    const appointment: any = body.durationMinutes == null && isValidObjectId(body.appointmentId) ? await Appointment.findById(body.appointmentId).lean() : null;
    const durationMinutes = body.durationMinutes ?? (appointment ? Math.round((appointment.endsAt.getTime() - appointment.startsAt.getTime()) / 60000) : null);
    const session = await Session.create({ patientId: attendance.patientId, attendanceId: attendance._id, attendanceItemId: item._id, appointmentId: body.appointmentId ?? null, procedureName: item.procedureName, performedAt: body.performedAt ?? new Date(), durationMinutes, data: body.data ?? {}, schemaSnapshot: item.sessionSchema, notes: body.notes ?? null });
    item.sessionsPerformed += 1;
    try { await attendance.save(); } catch (error) { await Session.deleteOne({ _id: session._id }); throw error; }
    return c.json(session, 201);
  })
  .get('/api/sessions/:id', async (c) => {
    const session: any = isValidObjectId(c.req.param('id')) ? await Session.findById(c.req.param('id')).populate('patientId', 'fullName').lean() : null;
    if (!session) return fail(c, 'Sessão não encontrada.', 404);
    const photos = await Promise.all((session.photos ?? []).map(async (photo: any) => ({ ...photo, url: await downloadUrl(photo.objectKey).catch(() => null) })));
    return c.json({ ...session, photos });
  })
  .patch('/api/sessions/:id', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') || (body.data !== undefined && (typeof body.data !== 'object' || body.data === null || Array.isArray(body.data))) || (body.durationMinutes != null && !validDuration(body.durationMinutes))) return fail(c, 'Dados da sessão inválidos.');
    const update: Record<string, unknown> = {};
    if (body.notes !== undefined) update.notes = body.notes?.trim() || null;
    if (body.data !== undefined) update.data = body.data;
    if (body.durationMinutes !== undefined) update.durationMinutes = body.durationMinutes;
    const result = isValidObjectId(c.req.param('id')) ? await Session.findByIdAndUpdate(c.req.param('id'), update, { returnDocument: 'after' }).lean() : null;
    return result ? c.json(result) : fail(c, 'Sessão não encontrada.', 404);
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
    return c.json(await PatientAnamnesis.create({ patientId: body.patientId, anamnesisId: body.anamnesisId, attendanceId: body.attendanceId ?? null, version: current.version, schemaSnapshot: current.schema, required: body.required ?? anamnesis.requiredByDefault }), 201);
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
    const [attendances, sessions, appointments] = await Promise.all([Attendance.find({ patientId: patient._id }).lean(), Session.find({ patientId: patient._id }).sort({ performedAt: 1 }).lean(), Appointment.find({ patientId: patient._id }).lean()]);
    const payments: any[] = await Payment.find({ attendanceId: { $in: attendances.map((attendance: any) => attendance._id) } }).lean();
    return c.json(buildRelationship(attendances, sessions, payments, appointments));
  })
  .get('/api/patients/:id/history', async (c) => {
    if (!isValidObjectId(c.req.param('id'))) return fail(c, 'Paciente não encontrado.', 404);
    const patient = await Patient.findById(c.req.param('id')).lean(); if (!patient) return fail(c, 'Paciente não encontrado.', 404);
    const [attendances, appointments, sessions, forms] = await Promise.all([Attendance.find({ patientId: patient._id }).lean(), Appointment.find({ patientId: patient._id }).lean(), Session.find({ patientId: patient._id }).lean(), PatientAnamnesis.find({ patientId: patient._id }).populate('anamnesisId', 'title').lean()]);
    const attendanceIds = attendances.map((p: any) => p._id), payments = await Payment.find({ attendanceId: { $in: attendanceIds } }).lean();
    const events: any[] = [...attendances.map((p: any) => ({ type: 'attendance', at: p.createdAt, title: `Atendimento: ${p.offerName}`, details: p })), ...appointments.map((a: any) => ({ type: 'appointment', at: a.startsAt, title: `Agendamento · ${appointmentStatusLabel[a.status] ?? a.status}`, details: a })), ...sessions.map((s: any) => ({ type: 'session', at: s.performedAt, title: `${s.procedureName} realizado`, details: s })), ...payments.map((p: any) => ({ type: 'payment', at: p.receivedAt, title: `Pagamento ${p.method}`, details: p })), ...forms.map((f: any) => ({ type: 'anamnesis', at: f.response?.submittedAt ?? f._id.getTimestamp(), title: `${f.anamnesisId?.title ?? 'Anamnese'} · ${f.response ? f.response.validUntil < new Date() ? 'vencida' : 'respondida' : 'pendente'}`, details: f }))];
    const pending = events.filter((event) => /pendente|vencida/.test(event.title) || (event.type === 'appointment' && event.details.status === 'planned'));
    return c.json({ patient, events: events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), pending });
  });
