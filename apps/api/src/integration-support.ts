import { describe } from 'bun:test';
import { and, eq, inArray } from 'drizzle-orm';
import { authAccounts, authSessions, authUsers, getDatabase, tenants } from '@clinicare/db';
import { provisionClinic } from './admin-commands';

type AppLike = { request(path: string, init?: RequestInit): Promise<Response> };

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

const integrationCookies = new Map<string, string>();

export type IntegrationClinic = {
  tenantId: string;
  email: string;
  headers(extra?: Record<string, string>): Record<string, string>;
};

export function integrationHeaders(tenantId: string, extra: Record<string, string> = {}) {
  const cookie = integrationCookies.get(tenantId);
  if (!cookie) throw new Error(`No integration session registered for tenant ${tenantId}.`);
  return { 'content-type': 'application/json', 'x-tenant-id': tenantId, cookie, ...extra };
}

export async function provisionIntegrationClinic(api: { request: (...args: any[]) => any }, label: string, requestedTenantId?: string): Promise<IntegrationClinic> {
  const suffix = crypto.randomUUID();
  const email = `integration-${label}-${suffix}@example.test`;
  const provisioned = await provisionClinic({
    tenantId: requestedTenantId ?? crypto.randomUUID(),
    clinicName: `Integration ${label} ${suffix}`,
    administratorName: 'Integration Administrator',
    email,
    password: 'integration-password-123',
  });
  const response = await api.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'integration-password-123' }),
  });
  if (!response.ok) throw new Error(`Integration authentication failed with status ${response.status}.`);
  const setCookie = response.headers.get('set-cookie');
  const cookie = setCookie?.split(';', 1)[0];
  if (!cookie) throw new Error('Integration authentication did not return a session cookie.');
  integrationCookies.set(provisioned.tenant.id, cookie);
  return {
    tenantId: provisioned.tenant.id,
    email,
    headers: (extra = {}) => ({ 'content-type': 'application/json', cookie, ...extra }),
  };
}

export async function cleanupIntegrationClinics(tenantIds: string[]) {
  if (!tenantIds.length) return;
  const database = getDatabase();
  const users = await database.select({ id: authUsers.id }).from(authUsers).where(inArray(authUsers.tenantId, tenantIds));
  const userIds = users.map(({ id }) => id);
  if (userIds.length) {
    await database.delete(authSessions).where(inArray(authSessions.userId, userIds));
    await database.delete(authAccounts).where(inArray(authAccounts.userId, userIds));
    await database.delete(authUsers).where(inArray(authUsers.id, userIds));
  }
  await database.delete(tenants).where(inArray(tenants.id, tenantIds));
  for (const tenantId of tenantIds) integrationCookies.delete(tenantId);
}
