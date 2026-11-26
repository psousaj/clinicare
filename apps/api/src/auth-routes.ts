import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { getAuth } from './auth';
import { authUsers, getDatabase, tenants, userTenantMemberships } from '@clinicare/db';

export function authHandler(request: Request) {
  return getAuth().handler(request);
}

export type ClinicSession = {
  userId: string;
  tenantId: string;
  user: { id: string; name: string; email: string };
  session: { id: string; expiresAt: Date; token: string };
};

type ClinicSessionResolution =
  | { kind: 'unauthenticated' }
  | { kind: 'confirmation-required' }
  | { kind: 'unlinked' }
  | { kind: 'forbidden-role' }
  | { kind: 'ambiguous' }
  | { kind: 'inactive' }
  | { kind: 'authorized'; session: ClinicSession };

export async function resolveClinicSession(request: Request): Promise<ClinicSessionResolution> {
  const result = await getAuth().api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  if (!result) return { kind: 'unauthenticated' };
  const [user] = await getDatabase().select({
    id: authUsers.id,
    name: authUsers.name,
    email: authUsers.email,
    emailVerified: authUsers.emailVerified,
  }).from(authUsers).where(eq(authUsers.id, result.user.id));
  if (!user) return { kind: 'unauthenticated' };
  if (!user.emailVerified) return { kind: 'confirmation-required' };
  const memberships = await getDatabase().select({
    tenantId: userTenantMemberships.tenantId,
    role: userTenantMemberships.role,
    active: tenants.active,
  })
    .from(userTenantMemberships)
    .innerJoin(tenants, eq(tenants.id, userTenantMemberships.tenantId))
    .where(eq(userTenantMemberships.userId, user.id));
  if (memberships.length === 0) return { kind: 'unlinked' };
  if (memberships.length !== 1) return { kind: 'ambiguous' };
  const membership = memberships[0]!;
  if (membership.role !== 'admin') return { kind: 'forbidden-role' };
  if (!membership.active) return { kind: 'inactive' };
  return {
    kind: 'authorized',
    session: {
      userId: user.id,
      tenantId: membership.tenantId,
      user: { id: user.id, name: user.name, email: user.email },
      session: { id: result.session.id, expiresAt: result.session.expiresAt, token: result.session.token },
    },
  };
}

export async function getClinicSession(request: Request): Promise<ClinicSession | null> {
  const resolution = await resolveClinicSession(request);
  return resolution.kind === 'authorized' ? resolution.session : null;
}

export async function requireClinicSession(c: Context, next: Next) {
  const resolution = await resolveClinicSession(c.req.raw);
  if (resolution.kind === 'unauthenticated') {
    return c.json({ error: 'Autenticação necessária.', code: 'AUTHENTICATION_REQUIRED' }, 401);
  }
  if (resolution.kind === 'confirmation-required') {
    return c.json({ error: 'Confirme seu e-mail para acessar as operações clínicas.', code: 'EMAIL_CONFIRMATION_REQUIRED' }, 403);
  }
  if (resolution.kind === 'unlinked') {
    return c.json({ error: 'Conta sem vínculo autorizado com uma clínica.', code: 'CLINIC_MEMBERSHIP_REQUIRED' }, 403);
  }
  if (resolution.kind === 'forbidden-role') {
    return c.json({ error: 'O papel do vínculo não autoriza operações clínicas.', code: 'CLINIC_ROLE_FORBIDDEN' }, 403);
  }
  if (resolution.kind === 'ambiguous') {
    return c.json({ error: 'A conta possui mais de um vínculo; a seleção explícita de clínica ainda não está disponível.', code: 'CLINIC_SELECTION_REQUIRED' }, 409);
  }
  if (resolution.kind === 'inactive') {
    return c.json({ error: 'A clínica está desativada.', code: 'CLINIC_INACTIVE' }, 403);
  }
  c.set('clinicSession', resolution.session);
  return next();
}

export function clinicSession(c: Context) {
  return c.get('clinicSession') as ClinicSession;
}
