import { eq, sql } from 'drizzle-orm';
import { authUsers, getDatabase, tenants, userTenantMemberships } from '@clinicare/db';
import { getAuth } from './auth';

export type ClinicOnboardingInput = { name: unknown; cnpj: unknown; address: unknown; phone: unknown };

function required(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw Object.assign(new Error(`${label} é obrigatório.`), { status: 400 });
  return value.trim();
}

function validCnpj(value: string) {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const digit = (base: string, weights: number[]) => {
    const sum = [...base].reduce((total, character, index) => total + Number(character) * weights[index]!, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = digit(value.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = digit(value.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return value.endsWith(`${first}${second}`);
}

function validate(input: ClinicOnboardingInput) {
  const name = required(input.name, 'Nome da clínica');
  const cnpj = input.cnpj && typeof input.cnpj === 'string' ? input.cnpj.replace(/\D/g, '') : '';
  if (!validCnpj(cnpj)) throw Object.assign(new Error('Informe um CNPJ válido.'), { status: 400 });
  const address = required(input.address, 'Endereço');
  const phone = input.phone && typeof input.phone === 'string' ? input.phone.replace(/\D/g, '') : '';
  if (phone.length < 10 || phone.length > 11) throw Object.assign(new Error('Telefone deve conter 10 ou 11 dígitos.'), { status: 400 });
  return { name, cnpj, address, phone };
}

export async function createClinicForUser(userId: string, input: ClinicOnboardingInput) {
  const values = validate(input);
  return getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`clinic-onboarding:${userId}`}, 0))`);
    const [user] = await tx.select().from(authUsers).where(eq(authUsers.id, userId)).for('update');
    if (!user || !user.emailVerified) throw Object.assign(new Error('Confirme seu e-mail antes de cadastrar a clínica.'), { status: 403 });
    const memberships = await tx.select({ tenantId: userTenantMemberships.tenantId })
      .from(userTenantMemberships).where(eq(userTenantMemberships.userId, userId));
    if (memberships.length) {
      if (memberships.length > 1) throw Object.assign(new Error('A conta possui mais de um vínculo.'), { status: 409 });
      const [existing] = await tx.select().from(tenants).where(eq(tenants.id, memberships[0]!.tenantId));
      if (!existing) throw new Error('Clínica vinculada não encontrada.');
      if (!existing.active) throw Object.assign(new Error('A clínica vinculada está desativada; o onboarding não pode reativá-la.'), { status: 409 });
      if (existing.name !== values.name || existing.cnpj !== values.cnpj || existing.address !== values.address || existing.phone !== values.phone) {
        throw Object.assign(new Error('O onboarding já foi concluído com outros dados; recarregue o estado da clínica.'), { status: 409 });
      }
      return { tenant: existing, recovered: true };
    }
    const [tenant] = await tx.insert(tenants).values({ ...values, active: true }).returning();
    await tx.insert(userTenantMemberships).values({ userId, tenantId: tenant!.id, role: 'admin' });
    // No paid subscription is created: absence of a subscription resolves to Free.
    return { tenant: tenant!, recovered: false };
  });
}

export async function getPersonalAccountState(request: Request) {
  const session = await getAuth().api.getSession({
    headers: request.headers, query: { disableCookieCache: true },
  });
  if (!session) return { kind: 'unauthenticated' as const };
  const db = getDatabase();
  const [user] = await db.select({ id: authUsers.id, name: authUsers.name, email: authUsers.email, emailVerified: authUsers.emailVerified })
    .from(authUsers).where(eq(authUsers.id, session.user.id));
  if (!user) return { kind: 'unauthenticated' as const };
  if (!user.emailVerified) return { kind: 'confirmation' as const, user: { id: user.id, name: user.name, email: user.email } };
  const memberships = await db.select({ tenant: tenants }).from(userTenantMemberships)
    .innerJoin(tenants, eq(tenants.id, userTenantMemberships.tenantId))
    .where(eq(userTenantMemberships.userId, user.id));
  if (memberships.length > 1) return { kind: 'ambiguous' as const };
  const membership = memberships[0];
  if (membership) return membership.tenant.active
    ? { kind: 'clinic' as const, user: { id: user.id, name: user.name, email: user.email }, tenant: membership.tenant }
    : { kind: 'inactive' as const };
  return { kind: 'onboarding' as const, user: { id: user.id, name: user.name, email: user.email } };
}
