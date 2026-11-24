import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { authSchema, authUsers, getDatabase, tenants } from '@clinicare/db';
import { getTrustedOrigins } from './auth-config';

export const SESSION_DURATION_SECONDS = 24 * 60 * 60;

export function getAuth() {
  return betterAuth({
    appName: 'Clínicare',
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    trustedOrigins: getTrustedOrigins(),
    basePath: '/api/auth',
    database: drizzleAdapter(getDatabase(), { provider: 'pg', schema: authSchema, transaction: true }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
    },
    user: {
      additionalFields: {
        tenantId: { type: 'string', required: true, input: false },
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
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-in/email' || typeof ctx.body?.email !== 'string') return;
        const email = ctx.body.email.trim().toLowerCase();
        const [tenant] = await getDatabase()
          .select({ active: tenants.active })
          .from(authUsers)
          .innerJoin(tenants, eq(tenants.id, authUsers.tenantId))
          .where(eq(authUsers.email, email));
        if (tenant && !tenant.active) {
          throw new APIError('UNAUTHORIZED', {
            message: 'Invalid email or password',
            code: 'INVALID_EMAIL_OR_PASSWORD',
          });
        }
      }),
    },
    advanced: {
      database: { validateSchema: false },
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
  });
}

export type AuthInstance = ReturnType<typeof getAuth>;
