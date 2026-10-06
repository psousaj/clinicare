import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDatabase, getDatabase, getDatabasePool } from './index'
import {
  getDatabaseSchema,
  getMigrationsSchema,
  quoteIdentifier,
} from './database-config';

export async function migrateDatabase() {
  const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? new URL('../drizzle', import.meta.url).pathname;
  const migrationsSchema = getMigrationsSchema()
  const applicationSchema = getDatabaseSchema()
  if (applicationSchema) {
    await getDatabasePool().query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(applicationSchema)}`)
  }
  await getDatabasePool().query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(migrationsSchema)}`)
  await ensurePgTrgmExtension()
  await migrate(getDatabase(), { migrationsFolder, migrationsSchema });
}

async function ensurePgTrgmExtension() {
  const pool = getDatabasePool()
  const result = await pool.query<{ schema_name: string; owner_name: string }>(`select n.nspname as schema_name, r.rolname as owner_name from pg_extension e join pg_namespace n on n.oid = e.extnamespace join pg_roles r on r.oid = e.extowner where e.extname = 'pg_trgm'`)
  const currentSchema = result.rows[0]?.schema_name
  if (!currentSchema) {
    await pool.query('create extension if not exists pg_trgm schema public')
  } else if (currentSchema !== 'public') {
    if (result.rows[0]?.owner_name !== (await pool.query<{ current_user: string }>('select current_user')).rows[0]?.current_user) {
      throw new Error('pg_trgm is installed outside public and is not owned by the migration user; move it to public explicitly before migrating.')
    }
    await pool.query(`alter extension pg_trgm set schema public`)
  }
}

if (import.meta.main) {
  try {
    await migrateDatabase();
    console.log('PostgreSQL migrations applied.');
  } finally {
    await closeDatabase();
  }
}
