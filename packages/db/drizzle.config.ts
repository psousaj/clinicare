import type { Config } from 'drizzle-kit';

export default {
  schema: './src/relational-schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://clinicare:clinicare@localhost:5432/clinicare' },
} satisfies Config;
