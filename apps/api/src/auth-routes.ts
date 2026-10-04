import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { getAuth } from './auth';
import { authUsers, getDatabase, tenants } from '@clinicare/db';

export function authHandler(request: Request) {
  return getAuth().handler(request);
}

export type ClinicSession = {
  userId: string;
  tenantId: string;
  user: { id: string; name: string; email: string };
  session: { id: string; expiresAt: Date; token: string };
};

export async function getClinicSession(request: Request): Promise<ClinicSession | null> {
  const result = await getAuth().api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!result) return null;
  const [user] = await getDatabase().select({
    id: authUsers.id,
    name: authUsers.name,
    email: authUsers.email,
    tenantId: authUsers.tenantId,
  }).from(authUsers).where(eq(authUsers.id, result.user.id));
  if (!user) return null;
  const [tenant] = await getDatabase().select({ id: tenants.id, active: tenants.active }).from(tenants).where(eq(tenants.id, user.tenantId));
  if (!tenant?.active) return null;
  return {
    userId: user.id,
    tenantId: user.tenantId,
    user: { id: user.id, name: user.name, email: user.email },
    session: { id: result.session.id, expiresAt: result.session.expiresAt, token: result.session.token },
  };
}

export async function requireClinicSession(c: Context, next: Next) {
  const session = await getClinicSession(c.req.raw);
  if (!session) return c.json({ error: 'Autenticação necessária.' }, 401);
  c.set('clinicSession', session);
  return next();
}

export function clinicSession(c: Context) {
  return c.get('clinicSession') as ClinicSession;
}
