import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { authUsers, getDatabase } from '@clinicare/db';
import { clinicSession } from './auth-routes';

export async function updateInitialPasswordChoice(c: Context) {
  const body = await c.req.json().catch(() => null) as { choice?: unknown } | null;
  if (body?.choice !== 'accepted' && body?.choice !== 'declined') return c.json({ error: 'Escolha inválida.' }, 400);
  const session = clinicSession(c);
  await getDatabase().update(authUsers).set({ initialPasswordChoice: body.choice }).where(eq(authUsers.id, session.userId));
  return c.json({ choice: body.choice });
}
