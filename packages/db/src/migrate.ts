import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDatabase, getDatabase } from './index';

export async function migrateDatabase() {
  await migrate(getDatabase(), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
}

if (import.meta.main) {
  try {
    await migrateDatabase();
    console.log('PostgreSQL migrations applied.');
  } finally {
    await closeDatabase();
  }
}
