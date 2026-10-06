import { sql } from 'drizzle-orm';
import { closeDatabase, getDatabase } from './index';
import { tenantDefaults, tenants } from './relational-schema';

export async function seedDatabase(clinicName: string = tenantDefaults.name) {
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
