import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as relationalSchema from './relational-schema';
import * as authSchema from './auth-schema';

export type Database = NodePgDatabase<typeof relationalSchema & typeof authSchema>;

let pool: Pool | null = null;
let database: Database | null = null;

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  return url;
}

export function getDatabase(): Database {
  if (database) return database;
  const currentPool = pool ?? (pool = new Pool({ connectionString: getDatabaseUrl() }));
  database = drizzle(currentPool, { schema: { ...relationalSchema, ...authSchema } });
  return database;
}

export function getDatabasePool(): Pool {
  if (!pool) getDatabase();
  const currentPool = pool;
  if (!currentPool) throw new Error('PostgreSQL pool is not initialized.');
  return currentPool;
}

/** Connects to PostgreSQL and verifies that the database is reachable. */
export async function connectPostgresDatabase() {
  await getDatabasePool().query('select 1');
  return getDatabase();
}

export async function disconnectDatabase() {
  await closeDatabase();
}

export async function closeDatabase() {
  if (pool) await pool.end();
  pool = null;
  database = null;
}

export * from './relational-schema';
export * from './auth-schema';
export * from './crypto';
export * from './normalization';
export { migrateDatabase } from './migrate';
export { seedDatabase } from './seed';
