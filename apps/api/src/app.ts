import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, desc, eq, ilike, isNull, lt, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { patients, procedures, anamneses, anamnesisVersions, procedureAnamneses, packages, packageItems, contracts, contractVersions, plans, planItems, appliedContracts, payments, appointments, appointmentItems, sessions, sessionPhotos, patientAnamneses, anamnesisRequests, anamnesisResponses, responseNotes } from '../../../packages/db/src/schema';
import { uploadUrl, deleteObject } from './storage';

const connectionString = process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString }) : null;
const db = pool ? drizzle(pool) : null;
const fail = (c: Context, message: string) => c.json({ error: message }, 400);
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const schemaValid = (schema: Record<string, unknown>) => schema.type === 'object' && isRecord(schema.properties);
const now = () => new Date();
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

export const app = new Hono()
  .use('/api/*', cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
  .onError((error, c) => {
    console.error(error);
    return c.json({ error: 'Ocorreu um erro inesperado.' }, 500);
  })
  .get('/api/health', async (c) => {
    if (!db) return c.json({ status: 'ok' as const, service: 'clinicare-api', database: 'not-configured' as const });
    try { await pool!.query('select 1'); return c.json({ status: 'ok' as const, service: 'clinicare-api', database: 'connected' as const }); }
    catch { return c.json({ status: 'unavailable' as const, service: 'clinicare-api', database: 'disconnected' as const }, 503); }
  })
  .get('/api/patients', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const query = c.req.query('query');
    const rows = await db.select().from(patients).where(query ? ilike(patients.fullName, `%${query}%`) : undefined).orderBy(desc(patients.createdAt));
    return c.json(rows);
  })
  .get('/api/patients/:id', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const [patient] = await db.select().from(patients).where(eq(patients.id, c.req.param('id'))).limit(1);
    if (!patient) return c.json({ error: 'Paciente não encontrado.' }, 404);
    return c.json(patient);
  })
  .post('/api/patients', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ fullName?: unknown; phone?: unknown; email?: unknown }>().catch(() => null);
    if (!body || typeof body.fullName !== 'string' || body.fullName.trim().length < 2) return fail(c, 'Nome completo é obrigatório.');
    if (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string') return fail(c, 'Telefone inválido.');
    if (body.email !== undefined && body.email !== null && (typeof body.email !== 'string' || !validEmail(body.email))) return fail(c, 'E-mail inválido.');
    const [patient] = await db.insert(patients).values({ fullName: body.fullName.trim(), phone: typeof body.phone === 'string' ? body.phone.trim() || null : null, email: typeof body.email === 'string' ? body.email.trim().toLowerCase() || null : null }).returning();
    return c.json(patient, 201);
  })
  .put('/api/patients/:id', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ fullName?: unknown; phone?: unknown; email?: unknown; notes?: unknown }>().catch(() => null);
    if (!body || typeof body.fullName !== 'string' || body.fullName.trim().length < 2) return fail(c, 'Nome completo é obrigatório.');
    if (body.email !== undefined && body.email !== null && (typeof body.email !== 'string' || !validEmail(body.email))) return fail(c, 'E-mail inválido.');
    const [patient] = await db.update(patients).set({ fullName: body.fullName.trim(), phone: typeof body.phone === 'string' ? body.phone.trim() || null : null, email: typeof body.email === 'string' ? body.email.trim().toLowerCase() || null : null, notes: typeof body.notes === 'string' ? body.notes.trim() || null : null, updatedAt: now() }).where(eq(patients.id, c.req.param('id'))).returning();
    if (!patient) return c.json({ error: 'Paciente não encontrado.' }, 404);
    return c.json(patient);
  })
  .get('/api/procedures', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    return c.json(await db.select().from(procedures).orderBy(desc(procedures.createdAt)));
  })
  .post('/api/procedures', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ name?: unknown; description?: unknown; baseSessions?: unknown; durationMinutes?: unknown; priceCents?: unknown; sessionSchema?: unknown }>().catch(() => null);
    if (!body || typeof body.name !== 'string' || body.name.trim().length < 2) return fail(c, 'Nome do procedimento é obrigatório.');
    const baseSessions = Number(body.baseSessions ?? 1), durationMinutes = body.durationMinutes == null || body.durationMinutes === '' ? null : Number(body.durationMinutes), priceCents = Number(body.priceCents ?? 0);
    if (!Number.isInteger(baseSessions) || baseSessions < 1) return fail(c, 'A quantidade de sessões deve ser pelo menos 1.');
    if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1)) return fail(c, 'A duração deve ser um valor em minutos maior que zero.');
    if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > 2_147_483_647) return fail(c, 'O preço deve ser um valor válido.');
    if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') return fail(c, 'Descrição inválida.');
    const sessionSchema = body.sessionSchema === undefined ? { type: 'object', properties: {} } : body.sessionSchema;
    if (!isRecord(sessionSchema) || !schemaValid(sessionSchema)) return fail(c, 'O formulário do procedimento deve ser um JSON Schema do tipo object.');
    const [procedure] = await db.insert(procedures).values({ name: body.name.trim(), description: typeof body.description === 'string' ? body.description.trim() || null : null, baseSessions, durationMinutes, priceCents, sessionSchema }).returning();
    return c.json(procedure, 201);
  })
  .put('/api/procedures/:id', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ name?: unknown; description?: unknown; baseSessions?: unknown; durationMinutes?: unknown; priceCents?: unknown; sessionSchema?: unknown; active?: unknown }>().catch(() => null);
    if (!body || typeof body.name !== 'string' || body.name.trim().length < 2) return fail(c, 'Nome do procedimento é obrigatório.');
    const baseSessions = Number(body.baseSessions), durationMinutes = body.durationMinutes == null || body.durationMinutes === '' ? null : Number(body.durationMinutes), priceCents = Number(body.priceCents);
    if (!Number.isInteger(baseSessions) || baseSessions < 1) return fail(c, 'A quantidade de sessões deve ser pelo menos 1.');
    if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1)) return fail(c, 'A duração deve ser maior que zero.');
    if (!Number.isSafeInteger(priceCents) || priceCents < 0 || priceCents > 2_147_483_647) return fail(c, 'Preço inválido.');
    if (body.sessionSchema !== undefined && (!isRecord(body.sessionSchema) || !schemaValid(body.sessionSchema))) return fail(c, 'JSON Schema inválido.');
    const [procedure] = await db.update(procedures).set({ name: body.name.trim(), description: typeof body.description === 'string' ? body.description.trim() || null : null, baseSessions, durationMinutes, priceCents, sessionSchema: (body.sessionSchema ?? { type: 'object', properties: {} }) as Record<string, unknown>, active: body.active !== false, updatedAt: now() }).where(eq(procedures.id, c.req.param('id'))).returning();
    if (!procedure) return c.json({ error: 'Procedimento não encontrado.' }, 404);
    return c.json(procedure);
  })
  .get('/api/anamneses', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const rows = await db.select().from(anamneses).orderBy(desc(anamneses.createdAt));
    const result = await Promise.all(rows.map(async (row) => ({ ...row, versions: await db!.select().from(anamnesisVersions).where(eq(anamnesisVersions.anamnesisId, row.id)).orderBy(desc(anamnesisVersions.version)) })));
    return c.json(result);
  })
  .post('/api/anamneses', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ title?: unknown; schema?: unknown }>().catch(() => null);
    if (!body || typeof body.title !== 'string' || body.title.trim().length < 2 || !isRecord(body.schema) || !schemaValid(body.schema)) return fail(c, 'Informe o nome e um JSON Schema válido do tipo object.');
    const result = await db.transaction(async (tx) => {
      const [anamnesis] = await tx.insert(anamneses).values({ title: (body.title as string).trim() }).returning();
      const [version] = await tx.insert(anamnesisVersions).values({ anamnesisId: anamnesis.id, version: 1, schema: body.schema as Record<string, unknown> }).returning();
      return { ...anamnesis, versions: [version] };
    });
    return c.json(result, 201);
  })
  .post('/api/anamneses/:id/versions', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const id = c.req.param('id'), body = await c.req.json<{ schema?: unknown; restoreVersion?: unknown }>().catch(() => null);
    if (!body) return fail(c, 'Conteúdo inválido.');
    const current = await db.select().from(anamneses).where(eq(anamneses.id, id)).limit(1);
    if (!current.length) return c.json({ error: 'Anamnese não encontrada.' }, 404);
    let schema: Record<string, unknown> | undefined;
    if (Number.isInteger(body.restoreVersion)) {
      const [selected] = await db.select().from(anamnesisVersions).where(and(eq(anamnesisVersions.anamnesisId, id), eq(anamnesisVersions.version, Number(body.restoreVersion)))).limit(1);
      schema = selected?.schema;
    } else if (isRecord(body.schema) && schemaValid(body.schema)) schema = body.schema;
    if (!schema) return fail(c, 'Versão de origem ou JSON Schema inválido.');
    const version = await db.transaction(async (tx) => {
      const [latest] = await tx.select({ version: anamnesisVersions.version }).from(anamnesisVersions).where(eq(anamnesisVersions.anamnesisId, id)).orderBy(desc(anamnesisVersions.version)).limit(1);
      const [created] = await tx.insert(anamnesisVersions).values({ anamnesisId: id, version: (latest?.version ?? 0) + 1, schema }).returning();
      return created;
    });
    return c.json(version, 201);
  })
  .put('/api/anamneses/:id/associations', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ procedures?: unknown }>().catch(() => null);
    if (!Array.isArray(body?.procedures) || !body.procedures.every((item) => isRecord(item) && typeof item.procedureId === 'string' && typeof item.required === 'boolean')) return fail(c, 'Associações inválidas.');
    const result = await db.transaction(async (tx) => {
      await tx.delete(procedureAnamneses).where(eq(procedureAnamneses.anamnesisId, c.req.param('id')));
      const values = (body!.procedures as { procedureId: string; required: boolean }[]).map((item) => ({ anamnesisId: c.req.param('id'), procedureId: item.procedureId, required: item.required }));
      if (values.length) await tx.insert(procedureAnamneses).values(values);
      return values;
    });
    return c.json(result);
  })
  .post('/api/packages', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ name?: unknown; description?: unknown; priceCents?: unknown; promotionalPriceCents?: unknown; validFrom?: unknown; validUntil?: unknown; items?: unknown }>().catch(() => null);
    if (!body || typeof body.name !== 'string' || body.name.trim().length < 2 || !Number.isSafeInteger(body.priceCents) || Number(body.priceCents) < 0 || !Array.isArray(body.items) || body.items.length === 0) return fail(c, 'Pacote requer nome, preço e ao menos um procedimento.');
    if (!body.items.every((item) => isRecord(item) && typeof item.procedureId === 'string' && (item.sessionsOverride == null || (Number.isInteger(item.sessionsOverride) && Number(item.sessionsOverride) > 0)) && (item.priceOverrideCents == null || (Number.isInteger(item.priceOverrideCents) && Number(item.priceOverrideCents) >= 0)))) return fail(c, 'Itens do pacote inválidos.');
    const result = await db.transaction(async (tx) => {
      const [pack] = await tx.insert(packages).values({ name: (body.name as string).trim(), description: typeof body.description === 'string' ? body.description : null, priceCents: Number(body.priceCents), promotionalPriceCents: body.promotionalPriceCents == null ? null : Number(body.promotionalPriceCents), validFrom: body.validFrom ? new Date(String(body.validFrom)) : null, validUntil: body.validUntil ? new Date(String(body.validUntil)) : null }).returning();
      const items = (body.items as { procedureId: string; sessionsOverride?: number; priceOverrideCents?: number }[]).map((item) => ({ packageId: pack.id, procedureId: item.procedureId, sessionsOverride: item.sessionsOverride ?? null, priceOverrideCents: item.priceOverrideCents ?? null }));
      await tx.insert(packageItems).values(items);
      return { ...pack, items };
    });
    return c.json(result, 201);
  })
  .get('/api/packages', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const rows = await db.select().from(packages).orderBy(desc(packages.createdAt));
    return c.json(await Promise.all(rows.map(async (pack) => ({ ...pack, items: await db!.select().from(packageItems).where(eq(packageItems.packageId, pack.id)) }))));
  })
  .post('/api/contracts', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ title?: unknown; kind?: unknown; content?: unknown; procedureId?: unknown; packageId?: unknown }>().catch(() => null);
    if (!body || typeof body.title !== 'string' || body.title.trim().length < 2 || !['standard', 'procedure', 'package'].includes(String(body.kind)) || (body.content !== undefined && typeof body.content !== 'string')) return fail(c, 'Dados do contrato inválidos.');
    const result = await db.transaction(async (tx) => {
      const [contract] = await tx.insert(contracts).values({ title: (body.title as string).trim(), kind: String(body.kind), procedureId: typeof body.procedureId === 'string' ? body.procedureId : null, packageId: typeof body.packageId === 'string' ? body.packageId : null }).returning();
      const [version] = await tx.insert(contractVersions).values({ contractId: contract.id, version: 1, content: typeof body.content === 'string' ? body.content : null }).returning();
      return { ...contract, versions: [version] };
    });
    return c.json(result, 201);
  })
  .post('/api/contracts/:id/versions', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ content?: unknown; restoreVersion?: unknown }>().catch(() => null);
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, c.req.param('id'))).limit(1);
    if (!contract) return c.json({ error: 'Contrato não encontrado.' }, 404);
    const [source] = Number.isInteger(body?.restoreVersion) ? await db.select().from(contractVersions).where(and(eq(contractVersions.contractId, contract.id), eq(contractVersions.version, Number(body!.restoreVersion)))).limit(1) : [];
    const content = source?.content ?? (typeof body?.content === 'string' ? body.content : null);
    if (content === null) return fail(c, 'Conteúdo do contrato inválido.');
    const [latest] = await db.select({ version: contractVersions.version }).from(contractVersions).where(eq(contractVersions.contractId, contract.id)).orderBy(desc(contractVersions.version)).limit(1);
    const [created] = await db.insert(contractVersions).values({ contractId: contract.id, version: (latest?.version ?? 0) + 1, content }).returning();
    return c.json(created, 201);
  })
  .get('/api/contracts', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const rows = await db.select().from(contracts).orderBy(desc(contracts.createdAt));
    return c.json(await Promise.all(rows.map(async (contract) => ({ ...contract, versions: await db!.select().from(contractVersions).where(eq(contractVersions.contractId, contract.id)).orderBy(desc(contractVersions.version)) }))));
  })
  .post('/api/plans', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ patientId?: unknown; offerType?: unknown; offerId?: unknown; priceCents?: unknown }>().catch(() => null);
    if (!body || typeof body.patientId !== 'string' || !['procedure', 'package'].includes(String(body.offerType)) || typeof body.offerId !== 'string') return fail(c, 'Paciente e oferta são obrigatórios.');
    const offerType = body.offerType as 'procedure' | 'package';
    const existing = await db.select().from(plans).where(and(eq(plans.patientId, body.patientId), eq(plans.offerType, offerType), eq(plans.offerId, body.offerId))).limit(1);
    if (existing.length) return c.json({ error: 'O paciente já contratou esta oferta.' }, 409);
    const offer = offerType === 'procedure' ? (await db.select().from(procedures).where(eq(procedures.id, body.offerId)).limit(1))[0] : (await db.select().from(packages).where(eq(packages.id, body.offerId)).limit(1))[0];
    if (!offer || ('active' in offer && !offer.active)) return c.json({ error: 'Oferta não encontrada ou inativa.' }, 404);
    let rows: { procedureId: string; procedureName: string; sessionsTotal: number; sessionSchema: Record<string, unknown>; priceCents: number }[];
    if (offerType === 'procedure') {
      const procedure = offer as typeof procedures.$inferSelect;
      rows = [{ procedureId: procedure.id, procedureName: procedure.name, sessionsTotal: procedure.baseSessions, sessionSchema: procedure.sessionSchema, priceCents: procedure.priceCents }];
    } else {
      const pack = offer as typeof packages.$inferSelect;
      const items = await db.select().from(packageItems).where(eq(packageItems.packageId, pack.id));
      const promoActive = (!pack.validFrom || pack.validFrom <= now()) && (!pack.validUntil || pack.validUntil >= now());
      if ((pack.validFrom || pack.validUntil) && !promoActive) return c.json({ error: 'A validade deste pacote expirou ou ainda não começou.' }, 409);
      rows = await Promise.all(items.map(async (item) => {
        const [procedure] = await db!.select().from(procedures).where(eq(procedures.id, item.procedureId)).limit(1);
        if (!procedure) throw new Error('Procedimento do pacote não encontrado.');
        return { procedureId: procedure.id, procedureName: procedure.name, sessionsTotal: item.sessionsOverride ?? procedure.baseSessions, sessionSchema: procedure.sessionSchema, priceCents: item.priceOverrideCents ?? procedure.priceCents };
      }));
    }
    const priceCents = Number.isSafeInteger(body.priceCents) && Number(body.priceCents) >= 0 ? Number(body.priceCents) : offerType === 'procedure' ? (offer as typeof procedures.$inferSelect).priceCents : ((offer as typeof packages.$inferSelect).promotionalPriceCents ?? (offer as typeof packages.$inferSelect).priceCents);
    const result = await db.transaction(async (tx) => {
      const [plan] = await tx.insert(plans).values({ patientId: body.patientId as string, offerType, offerId: offer.id, offerName: offer.name, priceCents }).returning();
      const items = await tx.insert(planItems).values(rows.map((row) => ({ planId: plan.id, ...row }))).returning();
      const docs = await tx.select().from(contracts).where(and(eq(contracts.active, true), sql`(${contracts.kind} = 'standard' or (${contracts.kind} = 'procedure' and ${contracts.procedureId} in (${sql.join(items.map((i) => sql`${i.procedureId}`), sql`, `)})) or (${contracts.kind} = 'package' and ${contracts.packageId} = ${offer.id}))`));
      const applied: typeof appliedContracts.$inferInsert[] = [];
      for (const contract of docs) {
        const [version] = await tx.select().from(contractVersions).where(eq(contractVersions.contractId, contract.id)).orderBy(desc(contractVersions.version)).limit(1);
        if (!version) continue;
        const [appliedDoc] = await tx.insert(appliedContracts).values({ planId: plan.id, contractVersionId: version.id, title: contract.title, objectKey: version.sourceObjectKey }).returning();
        applied.push(appliedDoc);
      }
      return { ...plan, items, contracts: applied };
    });
    return c.json(result, 201);
  })
  .get('/api/plans', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const rows = await db.select().from(plans).orderBy(desc(plans.createdAt));
    return c.json(await Promise.all(rows.map(async (plan) => ({ ...plan, items: await db!.select().from(planItems).where(eq(planItems.planId, plan.id)), payments: await db!.select().from(payments).where(eq(payments.planId, plan.id)), contracts: await db!.select().from(appliedContracts).where(eq(appliedContracts.planId, plan.id)) }))));
  })
  .post('/api/payments', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ planId?: unknown; amountCents?: unknown; method?: unknown; installments?: unknown; notes?: unknown }>().catch(() => null);
    if (!body || typeof body.planId !== 'string' || !Number.isSafeInteger(body.amountCents) || Number(body.amountCents) <= 0 || !['cash', 'pix', 'credit_card'].includes(String(body.method)) || !Number.isInteger(body.installments ?? 1) || Number(body.installments ?? 1) < 1) return fail(c, 'Pagamento inválido.');
    const [payment] = await db.insert(payments).values({ planId: body.planId, amountCents: Number(body.amountCents), method: String(body.method), installments: Number(body.installments ?? 1), notes: typeof body.notes === 'string' ? body.notes : null }).returning();
    return c.json(payment, 201);
  })
  .get('/api/appointments', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const start = c.req.query('from') ? new Date(c.req.query('from')!) : new Date(new Date().setDate(new Date().getDate() - 7));
    const end = c.req.query('to') ? new Date(c.req.query('to')!) : addDays(start, 14);
    const rows = await db.select().from(appointments).where(and(sql`${appointments.startsAt} >= ${start}`, sql`${appointments.startsAt} < ${end}`)).orderBy(appointments.startsAt);
    return c.json(await Promise.all(rows.map(async (a) => ({ ...a, items: await db!.select().from(appointmentItems).where(eq(appointmentItems.appointmentId, a.id)) }))));
  })
  .post('/api/appointments', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ patientId?: unknown; planItemIds?: unknown; startsAt?: unknown; endsAt?: unknown; status?: unknown; notes?: unknown }>().catch(() => null);
    const startsAt = new Date(String(body?.startsAt)), endsAt = new Date(String(body?.endsAt));
    if (!body || typeof body.patientId !== 'string' || !Array.isArray(body.planItemIds) || !body.planItemIds.length || !body.planItemIds.every((id) => typeof id === 'string') || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return fail(c, 'Dados do agendamento inválidos.');
    const validItems = await db.select().from(planItems).where(sql`${planItems.id} in (${sql.join((body.planItemIds as string[]).map((id) => sql`${id}`), sql`, `)})`);
    if (validItems.length !== body.planItemIds.length) return fail(c, 'Um ou mais procedimentos do plano não foram encontrados.');
    const [appointment] = await db.insert(appointments).values({ patientId: body.patientId, startsAt, endsAt, status: typeof body.status === 'string' ? body.status : 'planned', notes: typeof body.notes === 'string' ? body.notes : null }).returning();
    const items = await db.insert(appointmentItems).values((body.planItemIds as string[]).map((planItemId) => ({ appointmentId: appointment.id, planItemId }))).returning();
    return c.json({ ...appointment, items }, 201);
  })
  .patch('/api/appointments/:id', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ startsAt?: unknown; endsAt?: unknown; status?: unknown; notes?: unknown }>().catch(() => null);
    const update: Partial<typeof appointments.$inferInsert> = {};
    if (typeof body?.startsAt === 'string') update.startsAt = new Date(body.startsAt);
    if (typeof body?.endsAt === 'string') update.endsAt = new Date(body.endsAt);
    if (typeof body?.status === 'string' && ['planned', 'confirmed', 'rescheduled', 'cancelled', 'no_show'].includes(body.status)) update.status = body.status;
    if (typeof body?.notes === 'string') update.notes = body.notes;
    const [result] = await db.update(appointments).set(update).where(eq(appointments.id, c.req.param('id'))).returning();
    if (!result) return c.json({ error: 'Agendamento não encontrado.' }, 404);
    return c.json(result);
  })
  .post('/api/sessions', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ planItemId?: unknown; appointmentId?: unknown; performedAt?: unknown; data?: unknown; notes?: unknown }>().catch(() => null);
    if (!body || typeof body.planItemId !== 'string' || (body.data !== undefined && !isRecord(body.data))) return fail(c, 'Dados da sessão inválidos.');
    const [item] = await db.select().from(planItems).where(eq(planItems.id, body.planItemId)).limit(1);
    if (!item) return c.json({ error: 'Procedimento contratado não encontrado.' }, 404);
    const result = await db.transaction(async (tx) => {
      const [planSessions] = await tx.select({ count: sql<number>`count(*)::int` }).from(sessions).where(eq(sessions.planItemId, item.id));
      if (planSessions.count >= item.sessionsTotal) throw new Error('Todas as sessões contratadas já foram realizadas.');
      const [session] = await tx.insert(sessions).values({ planItemId: item.id, appointmentId: typeof body.appointmentId === 'string' ? body.appointmentId : null, performedAt: body.performedAt ? new Date(String(body.performedAt)) : now(), data: isRecord(body.data) ? body.data : {}, schemaSnapshot: item.sessionSchema, notes: typeof body.notes === 'string' ? body.notes : null }).returning();
      return session;
    }).catch((error) => { if (error instanceof Error && error.message.includes('Todas as sessões')) return null; throw error; });
    if (!result) return c.json({ error: 'Todas as sessões contratadas já foram realizadas.' }, 409);
    return c.json(result, 201);
  })
  .get('/api/sessions', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    return c.json(await db.select().from(sessions).orderBy(desc(sessions.performedAt)));
  })
  .post('/api/uploads/presign', async (c) => {
    const body = await c.req.json<{ contentType?: unknown; size?: unknown }>().catch(() => null);
    if (!body || typeof body.contentType !== 'string' || !Number.isInteger(body.size) || Number(body.size) < 1 || Number(body.size) > 10_000_000) return fail(c, 'Arquivo inválido ou maior que 10 MB.');
    if (!/^image\/(jpeg|png|webp)$/.test(body.contentType)) return fail(c, 'Formato permitido: JPEG, PNG ou WebP.');
    const key = `uploads/${randomUUID()}`;
    try { return c.json({ uploadUrl: await uploadUrl(key, body.contentType), objectKey: key, expiresInSeconds: 300 }); }
    catch { return c.json({ error: 'Armazenamento R2 não configurado.' }, 503); }
  })
  .post('/api/sessions/:id/photos', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ objectKey?: unknown; phase?: unknown; notes?: unknown }>().catch(() => null);
    if (!body || typeof body.objectKey !== 'string' || !/^uploads\/[a-f0-9-]{36}$/.test(body.objectKey) || !['before', 'during', 'after'].includes(String(body.phase))) return fail(c, 'Foto inválida.');
    const [photo] = await db.insert(sessionPhotos).values({ sessionId: c.req.param('id'), objectKey: body.objectKey, phase: String(body.phase), notes: typeof body.notes === 'string' ? body.notes : null }).returning();
    return c.json(photo, 201);
  })
  .delete('/api/sessions/:id/photos/:photoId', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const [photo] = await db.delete(sessionPhotos).where(and(eq(sessionPhotos.id, c.req.param('photoId')), eq(sessionPhotos.sessionId, c.req.param('id')))).returning();
    if (!photo) return c.json({ error: 'Foto não encontrada.' }, 404);
    try { await deleteObject(photo.objectKey); } catch (error) { console.error('R2 photo cleanup failed', error); }
    return c.json({ deleted: true });
  })
  .get('/api/patients/:id/history', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const id = c.req.param('id');
    const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
    if (!patient) return c.json({ error: 'Paciente não encontrado.' }, 404);
    const patientPlans = await db.select().from(plans).where(eq(plans.patientId, id)).orderBy(desc(plans.createdAt));
    const patientAnamnesisRows = await db.select().from(patientAnamneses).where(eq(patientAnamneses.patientId, id));
    const events: { type: string; at: Date; title: string; details?: unknown }[] = [];
    for (const plan of patientPlans) {
      events.push({ type: 'plan', at: plan.createdAt, title: `Contratação: ${plan.offerName}`, details: plan });
      const [items, planPayments, docs] = await Promise.all([db.select().from(planItems).where(eq(planItems.planId, plan.id)), db.select().from(payments).where(eq(payments.planId, plan.id)), db.select().from(appliedContracts).where(eq(appliedContracts.planId, plan.id))]);
      for (const pay of planPayments) events.push({ type: 'payment', at: pay.receivedAt, title: `Pagamento ${pay.method}`, details: pay });
      for (const doc of docs) events.push({ type: 'contract', at: doc.createdAt, title: doc.title, details: doc });
      for (const item of items) {
        const done = await db.select().from(sessions).where(eq(sessions.planItemId, item.id)).orderBy(desc(sessions.performedAt));
        for (const session of done) events.push({ type: 'session', at: session.performedAt, title: `${item.procedureName} realizado`, details: session });
      }
    }
    const patientAppointments = await db.select().from(appointments).where(eq(appointments.patientId, id));
    for (const appointment of patientAppointments) events.push({ type: 'appointment', at: appointment.startsAt, title: `Agendamento · ${appointment.status}`, details: appointment });
    for (const applied of patientAnamnesisRows) {
      const [anamnesis] = await db.select().from(anamneses).where(eq(anamneses.id, applied.anamnesisId)).limit(1);
      const [response] = await db.select().from(anamnesisResponses).where(eq(anamnesisResponses.patientAnamnesisId, applied.id)).orderBy(desc(anamnesisResponses.submittedAt)).limit(1);
      events.push({ type: 'anamnesis', at: response?.submittedAt ?? now(), title: `${anamnesis?.title ?? 'Anamnese'} · ${response ? response.validUntil < now() ? 'vencida' : 'respondida' : 'pendente'}`, details: response ?? applied });
    }
    return c.json({ patient, events: events.sort((a, b) => b.at.getTime() - a.at.getTime()), pending: events.filter((e) => /pendente|vencida|planned/.test(e.title)) });
  })
  .post('/api/patient-anamneses', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ patientId?: unknown; planId?: unknown; anamnesisId?: unknown; required?: unknown }>().catch(() => null);
    if (!body || typeof body.patientId !== 'string' || typeof body.anamnesisId !== 'string') return fail(c, 'Paciente e anamnese são obrigatórios.');
    const [anamnesis] = await db.select().from(anamneses).where(eq(anamneses.id, body.anamnesisId)).limit(1);
    const [version] = anamnesis ? await db.select().from(anamnesisVersions).where(eq(anamnesisVersions.anamnesisId, anamnesis.id)).orderBy(desc(anamnesisVersions.version)).limit(1) : [];
    if (!version) return c.json({ error: 'Anamnese ativa não encontrada.' }, 404);
    const [applied] = await db.insert(patientAnamneses).values({ patientId: body.patientId, planId: typeof body.planId === 'string' ? body.planId : null, anamnesisId: body.anamnesisId, versionId: version.id, required: body.required !== false }).returning();
    return c.json(applied, 201);
  })
  .post('/api/anamnesis-requests', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ patientAnamnesisId?: unknown }>().catch(() => null);
    if (typeof body?.patientAnamnesisId !== 'string') return fail(c, 'Anamnese do paciente é obrigatória.');
    const [applied] = await db.select().from(patientAnamneses).where(eq(patientAnamneses.id, body.patientAnamnesisId)).limit(1);
    if (!applied) return c.json({ error: 'Anamnese aplicada não encontrada.' }, 404);
    const token = randomBytes(32).toString('base64url');
    const [request] = await db.insert(anamnesisRequests).values({ patientAnamnesisId: applied.id, tokenHash: hashToken(token), expiresAt: addDays(now(), 7) }).returning();
    return c.json({ id: request.id, url: `/public/anamnesis/${token}`, expiresAt: request.expiresAt }, 201);
  })
  .put('/api/anamnesis-requests/:id/refresh', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const token = randomBytes(32).toString('base64url');
    const [request] = await db.update(anamnesisRequests).set({ tokenHash: hashToken(token), expiresAt: addDays(now(), 7), submittedAt: null, draft: {} }).where(eq(anamnesisRequests.id, c.req.param('id'))).returning();
    if (!request) return c.json({ error: 'Solicitação não encontrada.' }, 404);
    return c.json({ id: request.id, url: `/public/anamnesis/${token}`, expiresAt: request.expiresAt });
  })
  .get('/public/anamnesis/:token', async (c) => {
    if (!db) return c.json({ error: 'Service unavailable.' }, 503);
    const [request] = await db.select().from(anamnesisRequests).where(eq(anamnesisRequests.tokenHash, hashToken(c.req.param('token')))).limit(1);
    if (!request || request.expiresAt < now() || request.submittedAt) return c.json({ error: 'Link inválido, expirado ou já enviado.' }, 404);
    const [applied] = await db.select().from(patientAnamneses).where(eq(patientAnamneses.id, request.patientAnamnesisId)).limit(1);
    const [version] = applied ? await db.select().from(anamnesisVersions).where(eq(anamnesisVersions.id, applied.versionId)).limit(1) : [];
    const [anamnesis] = applied ? await db.select().from(anamneses).where(eq(anamneses.id, applied.anamnesisId)).limit(1) : [];
    if (!version || !anamnesis) return c.json({ error: 'Anamnese não encontrada.' }, 404);
    return c.json({ title: anamnesis.title, schema: version.schema, draft: request.draft });
  })
  .put('/public/anamnesis/:token/draft', async (c) => {
    if (!db) return c.json({ error: 'Service unavailable.' }, 503);
    const body = await c.req.json<{ draft?: unknown }>().catch(() => null);
    if (!isRecord(body?.draft)) return fail(c, 'Rascunho inválido.');
    const [request] = await db.select().from(anamnesisRequests).where(and(eq(anamnesisRequests.tokenHash, hashToken(c.req.param('token')),), isNull(anamnesisRequests.submittedAt))).limit(1);
    if (!request || request.expiresAt < now()) return c.json({ error: 'Link inválido ou expirado.' }, 404);
    const [updated] = await db.update(anamnesisRequests).set({ draft: body!.draft }).where(eq(anamnesisRequests.id, request.id)).returning();
    return c.json({ saved: true, updatedAt: updated.createdAt });
  })
  .post('/public/anamnesis/:token/submit', async (c) => {
    if (!db) return c.json({ error: 'Service unavailable.' }, 503);
    const body = await c.req.json<{ answers?: unknown }>().catch(() => null);
    if (!isRecord(body?.answers)) return fail(c, 'Respostas inválidas.');
    const result = await db.transaction(async (tx) => {
      const [request] = await tx.select().from(anamnesisRequests).where(eq(anamnesisRequests.tokenHash, hashToken(c.req.param('token')))).for('update').limit(1);
      if (!request || request.expiresAt < now() || request.submittedAt) return null;
      const [response] = await tx.insert(anamnesisResponses).values({ patientAnamnesisId: request.patientAnamnesisId, answers: body!.answers as Record<string, unknown>, validUntil: new Date(now().setFullYear(now().getFullYear() + 1)) }).returning();
      await tx.update(anamnesisRequests).set({ submittedAt: now(), draft: body!.answers as Record<string, unknown> }).where(eq(anamnesisRequests.id, request.id));
      return response;
    });
    if (!result) return c.json({ error: 'Link inválido, expirado ou já enviado.' }, 409);
    return c.json(result, 201);
  })
  .post('/api/anamnesis-responses/:id/notes', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ content?: unknown }>().catch(() => null);
    if (typeof body?.content !== 'string' || body.content.trim().length < 1) return fail(c, 'Observação obrigatória.');
    const [note] = await db.insert(responseNotes).values({ responseId: c.req.param('id'), content: body.content.trim() }).returning();
    return c.json(note, 201);
  });
