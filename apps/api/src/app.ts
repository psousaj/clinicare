import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/node-postgres';
import { desc, ilike } from 'drizzle-orm';
import { Pool } from 'pg';
import { patients, procedures } from '../../../packages/db/src/schema';

const connectionString = process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString }) : null;
const db = pool ? drizzle(pool) : null;

export const app = new Hono()
  .use('/api/*', cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }))
  .get('/api/health', async (c) => {
    if (!db) return c.json({ status: 'ok' as const, service: 'clinicare-api', database: 'not-configured' as const });
    try {
      await pool!.query('select 1');
      return c.json({ status: 'ok' as const, service: 'clinicare-api', database: 'connected' as const });
    } catch {
      return c.json({ status: 'unavailable' as const, service: 'clinicare-api', database: 'disconnected' as const }, 503);
    }
  })
  .get('/api/patients', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const query = c.req.query('query');
    const rows = await db.select().from(patients).where(query ? ilike(patients.fullName, `%${query}%`) : undefined).orderBy(desc(patients.createdAt));
    return c.json(rows);
  })
  .post('/api/patients', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ fullName?: unknown; phone?: unknown; email?: unknown }>().catch(() => null);
    if (!body || typeof body.fullName !== 'string' || body.fullName.trim().length < 2) return c.json({ error: 'Nome completo é obrigatório.' }, 400);
    if (body.phone !== undefined && body.phone !== null && typeof body.phone !== 'string') return c.json({ error: 'Telefone inválido.' }, 400);
    if (body.email !== undefined && body.email !== null && typeof body.email !== 'string') return c.json({ error: 'E-mail inválido.' }, 400);
    const [patient] = await db.insert(patients).values({ fullName: body.fullName.trim(), phone: typeof body.phone === 'string' ? body.phone.trim() || null : null, email: typeof body.email === 'string' ? body.email.trim().toLowerCase() || null : null }).returning();
    return c.json(patient, 201);
  })
  .get('/api/procedures', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const rows = await db.select().from(procedures).where(ilike(procedures.name, '%')).orderBy(desc(procedures.createdAt));
    return c.json(rows);
  })
  .post('/api/procedures', async (c) => {
    if (!db) return c.json({ error: 'Database is not configured.' }, 503);
    const body = await c.req.json<{ name?: unknown; description?: unknown; baseSessions?: unknown; durationMinutes?: unknown; priceCents?: unknown }>().catch(() => null);
    if (!body || typeof body.name !== 'string' || body.name.trim().length < 2) return c.json({ error: 'Nome do procedimento é obrigatório.' }, 400);
    const baseSessions = Number(body.baseSessions);
    const durationMinutes = Number(body.durationMinutes);
    const priceCents = Number(body.priceCents);
    if (!Number.isInteger(baseSessions) || baseSessions < 1) return c.json({ error: 'A quantidade de sessões deve ser pelo menos 1.' }, 400);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) return c.json({ error: 'A duração deve ser informada em minutos.' }, 400);
    if (!Number.isInteger(priceCents) || priceCents < 0) return c.json({ error: 'O preço deve ser um valor válido.' }, 400);
    if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') return c.json({ error: 'Descrição inválida.' }, 400);
    const [procedure] = await db.insert(procedures).values({ name: body.name.trim(), description: typeof body.description === 'string' ? body.description.trim() || null : null, baseSessions, durationMinutes, priceCents }).returning();
    return c.json(procedure, 201);
  });
