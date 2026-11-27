import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { authSchema, authUsers, getDatabase, tenants, userTenantMemberships } from '@clinicare/db';
import { getTrustedOrigins } from './auth-config';

export const SESSION_DURATION_SECONDS = 24 * 60 * 60;
export const EMAIL_VERIFICATION_SECONDS = 24 * 60 * 60;
const resendRateLimitKey = (email: string) => `verification-resend:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
const signupRateLimitKey = (email: string) => `verification-signup:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
const resendWindowMs = 60 * 60 * 1000;
const resendLimit = 3;

async function reserveVerificationEmail(email: string, identifier = resendRateLimitKey(email)) {
  const now = new Date();
  return getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${identifier}, 0))`);
    const [entry] = await tx.select().from(authSchema.verification)
      .where(eq(authSchema.verification.identifier, identifier)).limit(1);
    const attempts = entry && entry.expiresAt > now ? Number(entry.value) : 0;
    if (attempts >= resendLimit) return false;
    const next = {
      value: String(attempts + 1),
      expiresAt: new Date(now.getTime() + resendWindowMs),
      updatedAt: now,
    };
    if (entry) await tx.update(authSchema.verification).set(next)
      .where(eq(authSchema.verification.id, entry.id));
    else await tx.insert(authSchema.verification).values({
      id: crypto.randomUUID(), identifier, ...next, createdAt: now,
    });
    return true;
  });
}

async function releaseVerificationEmail(email: string, identifier = resendRateLimitKey(email)) {
  await getDatabase().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${identifier}, 0))`);
    const [entry] = await tx.select().from(authSchema.verification)
      .where(eq(authSchema.verification.identifier, identifier)).limit(1);
    if (!entry) return;
    const attempts = Number(entry.value);
    if (attempts <= 1) await tx.delete(authSchema.verification).where(eq(authSchema.verification.id, entry.id));
    else await tx.update(authSchema.verification).set({ value: String(attempts - 1), updatedAt: new Date() })
      .where(eq(authSchema.verification.id, entry.id));
  });
}

async function reserveOrThrow(email: string) {
  if (await reserveVerificationEmail(email)) return;
  throw new APIError('TOO_MANY_REQUESTS', {
    message: 'Aguarde antes de solicitar outra confirmação.',
    code: 'VERIFICATION_RESEND_LIMIT',
  });
}

async function sendVerificationEmail({ user, url }: { user: { email: string; name: string }; url: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('RESEND_API_KEY and EMAIL_FROM are required for email verification.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: user.email,
      subject: 'Confirme seu e-mail — Clínicare',
      html: `<p>Olá, ${escapeHtml(user.name)}.</p><p><a href="${escapeHtml(url)}">Confirme seu e-mail</a>. O link expira em 24 horas.</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend email delivery failed (${response.status}).`);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function getAuth() {
  return betterAuth({
    appName: 'Clínicare',
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    trustedOrigins: getTrustedOrigins(),
    basePath: '/api/auth',
    database: drizzleAdapter(getDatabase(), { provider: 'pg', schema: authSchema, transaction: true }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: false,
      minPasswordLength: 8,
      requireEmailVerification: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              email: user.email.trim().toLowerCase(),
            },
          }),
        },
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: EMAIL_VERIFICATION_SECONDS,
      sendVerificationEmail: async ({ user, url }, request) => {
        const isSignup = request?.url ? new URL(request.url).pathname.endsWith('/sign-up/email') : false;
        const identifier = isSignup ? signupRateLimitKey(user.email) : resendRateLimitKey(user.email);
        if (!isSignup) await reserveOrThrow(user.email);
        else if (!(await reserveVerificationEmail(user.email, identifier))) {
          throw new APIError('TOO_MANY_REQUESTS', {
            message: 'Aguarde antes de solicitar outra confirmação.',
            code: 'VERIFICATION_RESEND_LIMIT',
          });
        }
        try {
          const confirmationUrl = new URL(url);
          if (!user.emailVerified) confirmationUrl.searchParams.set('callbackURL', '/login?verified=1');
          await sendVerificationEmail({ user, url: confirmationUrl.toString() });
        } catch (error) {
          await releaseVerificationEmail(user.email, identifier);
          throw error;
        }
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-in/email' && typeof ctx.body?.email === 'string') {
          ctx.body.email = ctx.body.email.trim().toLowerCase();
        }
        if (ctx.path !== '/sign-in/email' || typeof ctx.body?.email !== 'string') return;
        const email = ctx.body.email;
        const accountMemberships = await getDatabase()
          .select({ active: tenants.active })
          .from(userTenantMemberships)
          .innerJoin(tenants, eq(tenants.id, userTenantMemberships.tenantId))
          .innerJoin(authUsers, eq(authUsers.id, userTenantMemberships.userId))
          .where(eq(authUsers.email, email));
        if (accountMemberships.length > 0 && !accountMemberships.some(({ active }) => active)) {
          throw new APIError('UNAUTHORIZED', {
            message: 'Invalid email or password',
            code: 'INVALID_EMAIL_OR_PASSWORD',
          });
        }
      }),
    },
    user: {
      additionalFields: {
        initialPasswordChoice: { type: 'string', required: false, input: false },
      },
      changeEmail: {
        enabled: true,
        updateEmailWithoutVerification: true,
      },
    },
    session: {
      expiresIn: SESSION_DURATION_SECONDS,
      updateAge: 0,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    advanced: {
      database: { validateSchema: false },
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
  });
}

export type AuthInstance = ReturnType<typeof getAuth>;
