import { eq } from 'drizzle-orm';
import { closeDatabase, getDatabase, tenants, authUsers, authSessions } from '@clinicare/db';
import { getAuth } from './auth';

export type ProvisionClinicInput = {
  clinicName: string;
  administratorName: string;
  email: string;
  password: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const requireText = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} é obrigatório.`);
  return value.trim();
};

function validateProvisionInput(input: ProvisionClinicInput) {
  const clinicName = requireText(input.clinicName, 'Nome da clínica');
  const administratorName = requireText(input.administratorName, 'Nome do administrador');
  const email = normalizeEmail(requireText(input.email, 'E-mail'));
  const password = requireText(input.password, 'Senha');
  if (password.length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('E-mail inválido.');
  return { clinicName, administratorName, email, password };
}

async function createBetterAuthClinicAdministrator(input: { tenantId: string; administratorName: string; email: string; password: string }) {
  const context = await getAuth().$context;
  const userId = crypto.randomUUID();
  const user = await context.internalAdapter.createUser({
    id: userId,
    name: input.administratorName,
    email: input.email,
    emailVerified: false,
    image: null,
    tenantId: input.tenantId,
    initialPasswordChoice: 'pending',
  }, { method: 'email-password' });

  try {
    const passwordHash = await context.password.hash(input.password);
    await context.internalAdapter.linkAccount({
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: passwordHash,
    });
  } catch (error) {
    await context.internalAdapter.deleteUser(user.id).catch(() => undefined);
    throw error;
  }

  return user;
}

export async function provisionClinic(input: ProvisionClinicInput) {
  const values = validateProvisionInput(input);
  const database = getDatabase();
  const [tenant] = await database.insert(tenants).values({ name: values.clinicName, active: true }).returning();

  try {
    const user = await createBetterAuthClinicAdministrator({
      tenantId: tenant.id,
      administratorName: values.administratorName,
      email: values.email,
      password: values.password,
    });
    return {
      tenant: { id: tenant.id, name: tenant.name, active: tenant.active },
      administrator: { id: user.id, name: user.name, email: user.email },
    };
  } catch (error) {
    await database.delete(tenants).where(eq(tenants.id, tenant.id)).catch(() => undefined);
    throw error;
  }
}

async function administratorByEmail(email: string) {
  const [user] = await getDatabase().select().from(authUsers).where(eq(authUsers.email, normalizeEmail(email)));
  if (!user) throw new Error('Administrador não encontrado.');
  return user;
}

export async function deactivateTenant(tenantId: string) {
  const database = getDatabase();
  const [tenant] = await database.update(tenants).set({ active: false }).where(eq(tenants.id, tenantId)).returning({ id: tenants.id });
  if (!tenant) throw new Error('Tenant não encontrado.');
  const [user] = await database.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.tenantId, tenantId));
  if (user) await database.delete(authSessions).where(eq(authSessions.userId, user.id));
  return { tenantId, active: false };
}

export async function reactivateTenant(tenantId: string) {
  const [tenant] = await getDatabase().update(tenants).set({ active: true }).where(eq(tenants.id, tenantId)).returning({ id: tenants.id });
  if (!tenant) throw new Error('Tenant não encontrado.');
  return { tenantId, active: true };
}

export async function resetClinicAdministratorPassword(email: string, password: string) {
  const nextPassword = requireText(password, 'Senha');
  if (nextPassword.length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
  const user = await administratorByEmail(email);
  const context = await getAuth().$context;
  const passwordHash = await context.password.hash(nextPassword);
  const [account] = await context.internalAdapter.findAccounts(user.id);
  if (!account) throw new Error('Credencial do administrador não encontrada.');
  await context.internalAdapter.updateAccount(account.id, { password: passwordHash });
  await getDatabase().delete(authSessions).where(eq(authSessions.userId, user.id));
  return { id: user.id, email: user.email };
}

export async function changeClinicAdministratorEmail(email: string, nextEmail: string) {
  const user = await administratorByEmail(email);
  const normalizedEmail = normalizeEmail(requireText(nextEmail, 'Novo e-mail'));
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('E-mail inválido.');
  const [existing] = await getDatabase().select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.email, normalizedEmail));
  if (existing && existing.id !== user.id) throw new Error('E-mail já está em uso.');
  const context = await getAuth().$context;
  await context.internalAdapter.updateUser(user.id, { email: normalizedEmail, emailVerified: false });
  return { id: user.id, email: normalizedEmail };
}

function cliArguments(args: string[]) {
  const [command, ...rest] = args;
  const options = new Map<string, string>();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error('Use opções no formato --nome valor.');
    options.set(key.slice(2), value);
  }
  return { command, options };
}

if (import.meta.main) {
  try {
    const { command, options } = cliArguments(Bun.argv.slice(2));
    if (command === 'provision-tenant') {
      console.log(JSON.stringify(await provisionClinic({
        clinicName: options.get('clinic-name') ?? '', administratorName: options.get('admin-name') ?? '',
        email: options.get('admin-email') ?? '', password: options.get('admin-password') ?? '',
      })));
    } else if (command === 'reset-password') {
      console.log(JSON.stringify(await resetClinicAdministratorPassword(options.get('admin-email') ?? '', options.get('admin-password') ?? '')));
    } else if (command === 'change-email') {
      console.log(JSON.stringify(await changeClinicAdministratorEmail(options.get('admin-email') ?? '', options.get('new-email') ?? '')));
    } else if (command === 'deactivate-tenant') {
      console.log(JSON.stringify(await deactivateTenant(requireText(options.get('tenant-id'), 'Tenant'))));
    } else if (command === 'reactivate-tenant') {
      console.log(JSON.stringify(await reactivateTenant(requireText(options.get('tenant-id'), 'Tenant'))));
    } else {
      throw new Error('Comando inválido. Use provision-tenant, reset-password, change-email, deactivate-tenant ou reactivate-tenant.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}
