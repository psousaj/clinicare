import { closeDatabase, getDatabasePool } from './index';
import { migrateLegacySchema } from './migrate';

const sourceSchema = process.argv[2];
if (!sourceSchema) {
  throw new Error('Usage: bun src/migrate-namespace.ts <explicit-legacy-schema>');
}

try {
  await migrateLegacySchema(getDatabasePool(), sourceSchema);
  console.log(`Renamed the confirmed legacy schema "${sourceSchema}" to "clinicare".`);
} finally {
  await closeDatabase();
}
