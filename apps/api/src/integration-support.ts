import { describe } from 'bun:test';

export function assertSafeIntegrationDatabase() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL is required for PostgreSQL integration tests.');
  const url = new URL(rawUrl);
  if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(url.hostname)) {
    throw new Error('Integration tests require a local PostgreSQL DATABASE_URL (localhost, 127.0.0.1, ::1, or postgres).');
  }
}

export const integration = process.env.DATABASE_URL ? (() => {
  assertSafeIntegrationDatabase();
  return describe;
})() : describe.skip;
