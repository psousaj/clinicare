import { sql } from 'drizzle-orm';
import { closeDatabase, getDatabase } from './index';
import { tenantDefaults, tenants } from './relational-schema';

export async function seedDatabase(clinicName: string = tenantDefaults.name) {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new Error('Fictitious tenant seeds are available only in development and test environments.');
  }
  const database = getDatabase();
  await database.insert(tenants).values({ ...tenantDefaults, name: clinicName }).onConflictDoNothing({ target: tenants.id });
  return database.select().from(tenants).where(sql`${tenants.id} = ${tenantDefaults.id}`);
}

if (import.meta.main) {
  try {
    await seedDatabase();
    console.log(`Seeded tenant ${tenantDefaults.id}.`);
  } finally {
    await closeDatabase();
  }
}
