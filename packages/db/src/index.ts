import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import mongoose from 'mongoose';
import * as relationalSchema from './relational-schema';

export type Database = NodePgDatabase<typeof relationalSchema>;

let pool: Pool | null = null;
let database: Database | null = null;
let mongoConnection: Promise<typeof mongoose> | null = null;

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  return url;
}

export function getDatabase(): Database {
  if (database) return database;
  const currentPool = pool ?? (pool = new Pool({ connectionString: getDatabaseUrl() }));
  database = drizzle(currentPool, { schema: relationalSchema });
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

/** Legacy MongoDB connection used by routes not yet migrated to PostgreSQL. */
export function connectDatabase(
  uri = process.env.MONGODB_URI,
) {
  if (!uri) throw new Error('MONGODB_URI is required.');
  mongoConnection ??= mongoose.connect(uri);
  return mongoConnection;
}

export async function disconnectDatabase() {
  mongoConnection = null;
  await mongoose.disconnect();
  await closeDatabase();
}

export async function closeDatabase() {
  if (pool) await pool.end();
  pool = null;
  database = null;
}

export * from './relational-schema';
export { migrateDatabase } from './migrate';
// Legacy domain schema re-exported while aggregates move incrementally.
export * from './schema';
