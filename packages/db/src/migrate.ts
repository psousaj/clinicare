import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDatabase, getDatabase } from './index';

export async function migrateDatabase() {
  const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? new URL('../drizzle', import.meta.url).pathname;
  await migrate(getDatabase(), { migrationsFolder });
}

if (import.meta.main) {
  try {
    await migrateDatabase();
    console.log('PostgreSQL migrations applied.');
  } finally {
    await closeDatabase();
  }
}
