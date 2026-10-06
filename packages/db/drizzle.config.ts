import { defineConfig } from 'drizzle-kit'
import { getMigrationsSchema, getSchemaFilter } from './src/database-config'

export default defineConfig({
  schema: './src/relational-schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://clinicare:clinicare@localhost:5432/clinicare',
  },
  schemaFilter: getSchemaFilter(),
  migrations: {
    schema: getMigrationsSchema(),
  },
})
