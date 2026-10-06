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
  await migrate(getDatabase(), { migrationsFolder, migrationsSchema });
}

if (import.meta.main) {
  try {
    await migrateDatabase();
    console.log('PostgreSQL migrations applied.');
  } finally {
    await closeDatabase();
  }
}
