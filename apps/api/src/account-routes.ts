import type { Context } from 'hono';
import { and, eq } from 'drizzle-orm';
import { authUsers, getDatabase, professionals, tenants } from '@clinicare/db';
import { clinicSession } from './auth-routes';

export async function updateInitialPasswordChoice(c: Context) {
  const body = await c.req.json().catch(() => null) as { choice?: unknown } | null;
  if (body?.choice !== 'accepted' && body?.choice !== 'declined') return c.json({ error: 'Escolha inválida.' }, 400);
  const session = clinicSession(c);
  await getDatabase().update(authUsers).set({ initialPasswordChoice: body.choice }).where(eq(authUsers.id, session.userId));
  return c.json({ choice: body.choice });
}

export async function getAccount(c: Context) {
  const session = clinicSession(c);
  const db = getDatabase();
  const [tenant] = await db.select({ id: tenants.id, name: tenants.name }).from(tenants).where(eq(tenants.id, session.tenantId));
  if (!tenant) return c.json({ error: 'Clínica não encontrada.' }, 404);
  return c.json({ user: session.user, tenant });
}

// Renomeia o responsável e/ou a clínica pelo painel (Configurações).
// E-mail e senha continuam gerenciados pelos comandos administrativos;
// o bootstrap via env só provisiona na primeira criação e nunca
// sobrescreve estes nomes depois.
export async function updateAccount(c: Context) {
  const session = clinicSession(c);
  const body = (await c.req.json().catch(() => null)) as { name?: unknown; clinicName?: unknown } | null;
  if (!body || (body.name === undefined && body.clinicName === undefined)) {
    return c.json({ error: 'Informe o nome do responsável ou o nome da clínica.' }, 400);
  }
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim().length < 2)) {
    return c.json({ error: 'Nome do responsável deve ter ao menos 2 caracteres.' }, 400);
  }
  if (body.clinicName !== undefined && (typeof body.clinicName !== 'string' || body.clinicName.trim().length < 2)) {
    return c.json({ error: 'Nome da clínica deve ter ao menos 2 caracteres.' }, 400);
  }
  const db = getDatabase();
  if (typeof body.name === 'string') {
    await db.update(authUsers).set({ name: body.name.trim() }).where(eq(authUsers.id, session.userId));
  }
  if (typeof body.clinicName === 'string') {
    await db.update(tenants).set({ name: body.clinicName.trim() }).where(eq(tenants.id, session.tenantId));
  }
  // Re-responde com os dados frescos (o snapshot da sessão ainda tem os nomes antigos).
  const [user] = await db.select({ id: authUsers.id, name: authUsers.name, email: authUsers.email }).from(authUsers).where(eq(authUsers.id, session.userId));
  const [tenant] = await db.select({ id: tenants.id, name: tenants.name }).from(tenants).where(eq(tenants.id, session.tenantId));
  if (!user || !tenant) return c.json({ error: 'Clínica não encontrada.' }, 404);
  return c.json({ user, tenant });
}

export async function getProfessionalProfile(c: Context) {
  const session = clinicSession(c);
  const db = getDatabase();
  const row = (await db.select().from(professionals).where(and(eq(professionals.tenantId, session.tenantId), eq(professionals.userId, session.userId))))[0];
  if (!row) return c.json(null);
  return c.json({
    id: row.id,
    userId: row.userId,
    registrationType: row.registrationType,
    registrationNumber: row.registrationNumber,
    registrationState: row.registrationState,
    active: row.active,
  });
}

export async function getDefaultSignature(c: Context) {
  const session = clinicSession(c);
  const [user] = await getDatabase().select({ defaultSignaturePng: authUsers.defaultSignaturePng }).from(authUsers).where(eq(authUsers.id, session.userId));
  if (!user) return c.json({ error: 'Usuário não encontrado.' }, 404);
  return c.json({ signaturePng: user.defaultSignaturePng });
}

function validSignaturePng(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('data:image/png;base64,')) return false;
  const encoded = value.slice('data:image/png;base64,'.length);
  if (encoded.length > 2_800_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) return false;
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < 68 || bytes.length > 2_000_000) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!png.every((byte, index) => bytes[index] === byte) || view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) return false;
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const colorType = bytes[25];
  return !!width && !!height && width <= 2400 && height <= 1600 && (colorType === 6 || colorType === 4);
}

export async function updateDefaultSignature(c: Context) {
  const session = clinicSession(c);
  const body = await c.req.json().catch(() => null) as { signaturePng?: unknown } | null;
  if (!body || (body.signaturePng !== null && !validSignaturePng(body.signaturePng))) return c.json({ error: 'Imagem de assinatura PNG inválida.' }, 400);
  await getDatabase().update(authUsers).set({ defaultSignaturePng: body.signaturePng as string | null }).where(eq(authUsers.id, session.userId));
  return c.json({ signaturePng: body.signaturePng ?? null });
}

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const REGISTRATION_TYPES = [
  'CRM', 'CRO', 'CREFITO', 'CRF', 'COREN', 'CRBM', 'CRBio', 'OUTRO',
] as const;

export async function updateProfessionalProfile(c: Context) {
  const session = clinicSession(c);
  const body = await c.req.json().catch(() => null) as any;
  if (!body || typeof body.registrationType !== 'string' || !body.registrationType.trim() || typeof body.registrationNumber !== 'string' || !body.registrationNumber.trim()) {
    return c.json({ error: 'Tipo e número de registro profissional são obrigatórios.' }, 400);
  }
  const rawType = body.registrationType.trim().toUpperCase();
  const matchedType = (REGISTRATION_TYPES as readonly string[]).find((t) => t.toUpperCase() === rawType) ?? body.registrationType.trim();
  const registrationType = matchedType;
  const registrationNumber = body.registrationNumber.trim();
  let registrationState: string | null = null;
  if (body.registrationState != null && String(body.registrationState).trim()) {
    const rawState = String(body.registrationState).trim().toUpperCase();
    if (!BRAZILIAN_STATES.includes(rawState as any)) {
      return c.json({ error: 'UF do registro profissional inválida.' }, 400);
    }
    registrationState = rawState;
  }
  const db = getDatabase();
  const [saved] = await db.insert(professionals).values({
    tenantId: session.tenantId,
    userId: session.userId,
    registrationType,
    registrationNumber,
    registrationState,
    active: true,
  }).onConflictDoUpdate({
    target: [professionals.userId],
    set: { registrationType, registrationNumber, registrationState, active: true, updatedAt: new Date() },
  }).returning();
  return c.json({
    id: saved.id,
    userId: saved.userId,
    registrationType: saved.registrationType,
    registrationNumber: saved.registrationNumber,
    registrationState: saved.registrationState,
    active: saved.active,
  });
}
