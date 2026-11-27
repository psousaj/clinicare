import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { signJWT } from 'better-auth/crypto';
import { authAccounts, authSchema, authSessions, authUsers, closeDatabase, connectPostgresDatabase, getDatabase, migrateDatabase } from '@clinicare/db';
import { app } from './app';
import { assertSafeIntegrationDatabase } from './integration-support';

const recipient = process.env.EMAIL_TEST_RECIPIENT;
const enabled = Boolean(process.env.DATABASE_URL && process.env.RESEND_API_KEY && process.env.EMAIL_FROM && recipient);

(enabled ? describe : describe.skip)('real Resend email verification integration', () => {
  const email = recipient!;
  const resendIdentifier = `verification-resend:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
  const signupIdentifier = `verification-signup:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
  let userId: string | undefined;

  beforeAll(async () => {
    assertSafeIntegrationDatabase();
    const databaseName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
    if (!databaseName.endsWith('_email_test')) {
      throw new Error('Email provider integration tests require an isolated database ending in _email_test.');
    }
    process.env.BETTER_AUTH_SECRET ??= 'clinicare-email-verification-integration-secret';
    await migrateDatabase();
    await connectPostgresDatabase();
    const existing = await getDatabase().select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.email, email));
    if (existing.length) throw new Error('EMAIL_TEST_RECIPIENT must not already exist in the isolated email integration database.');
    await getDatabase().delete(authSchema.verification).where(eq(authSchema.verification.identifier, resendIdentifier));
    await getDatabase().delete(authSchema.verification).where(eq(authSchema.verification.identifier, signupIdentifier));
  });

  afterAll(async () => {
    const [createdUser] = await getDatabase().select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.email, email));
    const cleanupUserId = userId ?? createdUser?.id;
    if (cleanupUserId) {
      await getDatabase().delete(authSessions).where(eq(authSessions.userId, cleanupUserId));
      await getDatabase().delete(authAccounts).where(eq(authAccounts.userId, cleanupUserId));
      await getDatabase().delete(authUsers).where(eq(authUsers.id, cleanupUserId));
    }
    await getDatabase().delete(authSchema.verification).where(eq(authSchema.verification.identifier, resendIdentifier));
    await getDatabase().delete(authSchema.verification).where(eq(authSchema.verification.identifier, signupIdentifier));
    await closeDatabase();
  });

  it('delivers a real signup confirmation to the configured isolated test inbox and blocks clinical access before confirmation', async () => {
    const testStartedAt = Date.now() - 10_000;
    const configuredApiKey = process.env.RESEND_API_KEY;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(async (input: URL | RequestInfo, init?: RequestInit) => {
      if (String(input) === 'https://api.resend.com/emails' && init?.method === 'POST'
        && new Headers(init.headers).get('authorization') === `Bearer ${configuredApiKey}`) {
        return new Response('{"message":"test delivery failure"}', { status: 503 });
      }
      return originalFetch(input, init as RequestInit);
    }, { preconnect: originalFetch.preconnect.bind(originalFetch) });
    let failedDeliveries: Response[];
    try {
      failedDeliveries = await Promise.all(Array.from({ length: 2 }, () => app.request('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Email Integration Test', email, password: 'integration-password-123' }),
      })));
    } finally {
      process.env.RESEND_API_KEY = configuredApiKey;
      globalThis.fetch = originalFetch;
    }
    expect(failedDeliveries.some((response) => response.ok)).toBe(true);
    expect(failedDeliveries.every((response) => [200, 422].includes(response.status))).toBe(true);
    const failedDelivery = failedDeliveries.find((response) => response.ok)!;
    let registrationResponse = failedDelivery;
    let accounts = await getDatabase().select({ id: authUsers.id, emailVerified: authUsers.emailVerified }).from(authUsers).where(eq(authUsers.email, email));
    const [signupQuotaAfterFailure] = await getDatabase().select().from(authSchema.verification)
      .where(eq(authSchema.verification.identifier, signupIdentifier));
    expect(signupQuotaAfterFailure).toBeUndefined();
    let signupRetryDelivered = false;
    if (!accounts.length) {
      const retry = await app.request('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Email Integration Test', email, password: 'integration-password-123' }),
      });
      expect(retry.ok).toBe(true);
      registrationResponse = retry;
      signupRetryDelivered = true;
      accounts = await getDatabase().select({ id: authUsers.id, emailVerified: authUsers.emailVerified }).from(authUsers).where(eq(authUsers.email, email));
    }
    const recovered = await app.request('/api/auth/send-verification-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    expect(recovered.ok).toBe(true);
    expect(accounts).toHaveLength(1);
    userId = accounts[0]!.id;
    expect((await registrationResponse.json() as { token: string | null }).token).toBeNull();
    expect(accounts[0]!.emailVerified).toBe(false);
    const [storedUser] = await getDatabase().select({ emailVerified: authUsers.emailVerified }).from(authUsers).where(eq(authUsers.id, userId!));
    expect(storedUser?.emailVerified).toBe(false);
    expect(await getDatabase().select().from(authSessions).where(eq(authSessions.userId, userId!))).toHaveLength(0);
    expect((await app.request('/api/patients')).status).toBe(401);
    const unverifiedSignIn = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'integration-password-123' }),
    });
    expect(unverifiedSignIn.status).toBe(403);
    expect((await unverifiedSignIn.json() as { code?: string }).code).toBe('EMAIL_NOT_VERIFIED');
    await app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Email Integration Retry', email, password: 'different-password-123' }),
    });
    expect(await getDatabase().select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.email, email))).toHaveLength(1);

    const resendAttempts = await Promise.all(Array.from({ length: 2 }, (_, index) => app.request('/api/auth/send-verification-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `172.20.${index + 1}.1` },
      body: JSON.stringify({ email }),
    })));
    for (const resend of resendAttempts) expect(resend.status).toBe(200);
    const limitedResend = await app.request('/api/auth/send-verification-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '172.20.3.1' },
      body: JSON.stringify({ email }),
    });
    expect(limitedResend.status).toBe(429);
    const [resendCounter] = await getDatabase().select().from(authSchema.verification)
      .where(eq(authSchema.verification.identifier, resendIdentifier));
    expect(Number(resendCounter?.value)).toBe(3);
    const resendList = await fetch('https://api.resend.com/emails?limit=100', {
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    expect(resendList.ok).toBe(true);
    const resendDeliveries = await resendList.json() as { data: Array<{ id: string; to: string[]; subject: string; created_at: string }> };
    const deliveries = resendDeliveries.data.filter((entry) => entry.to.includes(email) && entry.subject.includes('Confirme seu e-mail') && Date.parse(entry.created_at) >= testStartedAt);
    expect(deliveries.length).toBe(3 + Number(signupRetryDelivered));

    const deliveredMessages = await Promise.all(deliveries.map(async (delivery) => {
      const retrieved = await fetch(`https://api.resend.com/emails/${delivery.id}`, {
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      expect(retrieved.ok).toBe(true);
      return await retrieved.json() as { html: string };
    }));
    const rawLinks = deliveredMessages.map(({ html }) => html.match(/href="([^"]*\/api\/auth\/verify-email\?[^"]*)"/)?.[1]
      ?? html.match(/href="([^"]*\/verify-email\?[^"]*)"/)?.[1]);
    expect(rawLinks.every(Boolean)).toBe(true);
    const tokens = rawLinks.filter((link): link is string => Boolean(link))
      .map((link) => new URL(link.replaceAll('&amp;', '&')).searchParams.get('token')!);
    expect(tokens).toHaveLength(deliveries.length);
    const newestIndex = deliveries.reduce((latest, current, index) =>
      Date.parse(current.created_at) > Date.parse(deliveries[latest]!.created_at) ? index : latest, 0);
    const confirmationUrl = new URL(rawLinks[newestIndex]!.replaceAll('&amp;', '&'));
    const token = confirmationUrl.searchParams.get('token')!;
    expect(token.split('.')).toHaveLength(3);
    const expiredToken = await signJWT({ email }, process.env.BETTER_AUTH_SECRET!, -60);
    const expiredResponse = await app.request(`${confirmationUrl.pathname}?token=${encodeURIComponent(expiredToken)}&callbackURL=%2Flogin%3Fverified%3D1`);
    expect(expiredResponse.status).toBe(302);
    expect(expiredResponse.headers.get('location')).toContain('error=TOKEN_EXPIRED');
    expect((await getDatabase().select({ emailVerified: authUsers.emailVerified }).from(authUsers).where(eq(authUsers.id, userId!)))[0]?.emailVerified).toBe(false);
    const confirmation = await app.request(`${confirmationUrl.pathname}${confirmationUrl.search}`);
    expect([200, 302]).toContain(confirmation.status);
    expect((await getDatabase().select({ emailVerified: authUsers.emailVerified }).from(authUsers).where(eq(authUsers.id, userId!)))[0]?.emailVerified).toBe(true);
    expect(confirmation.headers.get('location')).toBe('/login?verified=1');
    const verifiedLogin = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.245' },
      body: JSON.stringify({ email, password: 'integration-password-123' }),
    });
    expect(verifiedLogin.status).toBe(200);
    const verifiedCookie = verifiedLogin.headers.get('set-cookie')?.split(';', 1)[0];
    expect((await app.request('/api/patients', { headers: { cookie: verifiedCookie! } })).status).toBe(403);
    const sessionsBeforeReuse = (await getDatabase().select().from(authSessions).where(eq(authSessions.userId, userId!))).length;
    const reused = await app.request(`${confirmationUrl.pathname}${confirmationUrl.search}`);
    expect(reused.status).toBe(302);
    expect(reused.headers.get('location')).toBe('/login?verified=1');
    expect((await getDatabase().select().from(authSessions).where(eq(authSessions.userId, userId!))).length).toBe(sessionsBeforeReuse);

  });
});
