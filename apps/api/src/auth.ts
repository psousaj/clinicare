import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { authSchema, getDatabase } from '@clinicare/db';
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
    advanced: {
      database: { validateSchema: false },
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
  });
}

export type AuthInstance = ReturnType<typeof getAuth>;
