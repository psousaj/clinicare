import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { app } from './app';
import { patients, procedures } from '../../../packages/db/src/schema';

let container: StartedPostgreSqlContainer;
let pool: Pool;
const originalDatabaseUrl = process.env.DATABASE_URL;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(`CREATE TABLE patients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text NOT NULL, phone text, email text, notes text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await pool.query(`CREATE TABLE procedures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text,
    base_sessions integer NOT NULL DEFAULT 1, duration_minutes integer, price_cents integer NOT NULL DEFAULT 0,
    session_schema jsonb NOT NULL DEFAULT '{"type":"object","properties":{}}'::jsonb,
    active integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  )`);
});

afterAll(async () => {
  await pool?.end();
  await container?.stop();
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe('prototype foundation API', () => {
  it('provides a health endpoint without login', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', service: 'clinicare-api' });
  });

  it('creates and lists patients through the public API', async () => {
    const name = `Ana Teste ${crypto.randomUUID()}`;
    const createResponse = await app.request('/api/patients', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fullName: name, phone: '11999999999', email: 'ANA@EXAMPLE.COM' }),
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { id: string; fullName: string; email: string };
    expect(created).toMatchObject({ fullName: name, email: 'ana@example.com' });
    const listResponse = await app.request(`/api/patients?query=${encodeURIComponent(name)}`);
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual([expect.objectContaining({ id: created.id, fullName: name })]);
  });

  it('rejects an invalid patient name without inserting a row', async () => {
    const before = await drizzle(pool).select().from(patients);
    const response = await app.request('/api/patients', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fullName: ' ' }),
    });
    expect(response.status).toBe(400);
    expect(await drizzle(pool).select().from(patients)).toHaveLength(before.length);
  });

  it('creates and lists procedures with price and duration', async () => {
    const name = `Peeling de teste ${crypto.randomUUID()}`;
    const createResponse = await app.request('/api/procedures', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, baseSessions: 3, durationMinutes: 45, priceCents: 12500 }),
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { id: string; baseSessions: number; priceCents: number };
    expect(created).toMatchObject({ baseSessions: 3, durationMinutes: 45, priceCents: 12500 });
    const listResponse = await app.request('/api/procedures');
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id, name })]));
  });

  it('rejects invalid procedure data', async () => {
    const response = await app.request('/api/procedures', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X', baseSessions: 0, durationMinutes: -2, priceCents: -1 }),
    });
    expect(response.status).toBe(400);
  });
});
