import { describe, expect, it } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { authUsers, clinicSubscriptions, getDatabase, payments, saasPlans, saasSubscriptionEvents, tenants, userTenantMemberships } from '@clinicare/db';
import { changeClinicSubscription, effectiveSaasPlan, getSaasSubscription, validateSaasPlanCapabilities, type SaasPlanId } from './saas-plans';

describe('SaaS plan resolution', () => {
  it.each([
    [null, 'free'],
    [{ planId: 'standard', status: 'active' }, 'standard'],
    [{ planId: 'pro', status: 'active' }, 'pro'],
    [{ planId: 'pro', status: 'paused' }, 'free'],
    [{ planId: 'standard', status: 'inactive' }, 'free'],
  ] as const)('resolves %j to %s', (subscription, expected) => {
    expect(effectiveSaasPlan(subscription as { planId: SaasPlanId; status: 'active' | 'paused' | 'inactive' } | null)).toBe(expected);
  });

  it('rejects an upper tier that omits lower-tier capabilities', () => {
    expect(() => validateSaasPlanCapabilities([
      { id: 'free', capabilities: ['patients.read'] },
      { id: 'standard', capabilities: [] },
      { id: 'pro', capabilities: ['patients.read'] },
    ])).toThrow('standard must include patients.read from free.');
  });
  it('rejects an incomplete plan catalog', () => {
    expect(() => validateSaasPlanCapabilities([
      { id: 'free', capabilities: [] },
      { id: 'standard', capabilities: [] },
    ])).toThrow('Missing SaaS plan pro.');
  });

  it('accepts cumulative capabilities even when plan rows are unordered', () => {
    expect(() => validateSaasPlanCapabilities([
      { id: 'pro', capabilities: ['free', 'standard', 'pro'] },
      { id: 'free', capabilities: ['free'] },
      { id: 'standard', capabilities: ['free', 'standard'] },
    ])).not.toThrow();
  });
  it('validates the shipped Free, Standard, and Pró capability matrix cumulatively', () => {
    const free = ['patients.crud', 'attendances.single_sessions'];
    const standard = [...free, 'contracts.generation'];
    const pro = [...standard, 'events'];
    expect(() => validateSaasPlanCapabilities([
      { id: 'free', capabilities: free },
      { id: 'standard', capabilities: standard },
      { id: 'pro', capabilities: pro },
    ])).not.toThrow();
  });
});

const integration = process.env.DATABASE_URL ? describe : describe.skip;
integration('SaaS subscription persistence', () => {
  it('migrates and persists priced catalog data and audit state without creating payment records', async () => {
    const db = getDatabase();
    const tenantId = crypto.randomUUID();
    const userId = `saas-test-${crypto.randomUUID()}`;
    let tenantCreated = false;
    let userCreated = false;
    try {
      await db.insert(tenants).values({ id: tenantId, name: 'SaaS model test' });
      tenantCreated = true;
      await db.insert(authUsers).values({ id: userId, name: 'SaaS actor', email: `${userId}@example.test`, emailVerified: true });
      userCreated = true;
      await db.insert(userTenantMemberships).values({ userId, tenantId, role: 'admin' });
      const catalog = await db.select().from(saasPlans);
      expect(catalog.map((plan) => plan.id)).toEqual(['free', 'standard', 'pro']);
      expect(catalog[0]?.capabilities.length).toBeGreaterThan(0);
      expect(catalog[1]?.capabilities).toEqual(expect.arrayContaining(catalog[0]!.capabilities));
      expect(catalog[2]?.capabilities).toEqual(expect.arrayContaining(catalog[1]!.capabilities));
      expect(catalog.every((plan) => plan.priceCents === null && plan.billingInterval === null)).toBe(true);

      const [subscription] = await db.insert(clinicSubscriptions).values({
        tenantId, planId: 'standard', status: 'active', startedAt: new Date(),
      }).returning();
      await db.insert(saasSubscriptionEvents).values({
        tenantId, subscriptionId: subscription!.id, actorUserId: userId,
        fromPlanId: null, toPlanId: 'standard', fromStatus: null, toStatus: 'active',
      });
      expect((await db.select().from(saasSubscriptionEvents).where(sql`${saasSubscriptionEvents.subscriptionId} = ${subscription!.id}`))).toHaveLength(1);
      await changeClinicSubscription({ tenantId, actorUserId: userId, planId: 'pro', status: 'paused' });
      const history = await db.select().from(clinicSubscriptions).where(sql`${clinicSubscriptions.tenantId} = ${tenantId}`);
      expect(history).toHaveLength(1);
      expect(history.filter((entry) => entry.endedAt === null)).toHaveLength(1);
      expect((await db.select().from(saasSubscriptionEvents).where(sql`${saasSubscriptionEvents.tenantId} = ${tenantId}`))).toHaveLength(2);
      await changeClinicSubscription({ tenantId, actorUserId: userId, planId: 'standard', status: 'active' });
      const resumed = await db.select().from(clinicSubscriptions).where(sql`${clinicSubscriptions.tenantId} = ${tenantId}`);
      expect(resumed).toHaveLength(1);
      expect(resumed[0]?.status).toBe('active');
      expect(resumed[0]?.planId).toBe('standard');
      const resumeEvent = await db.select().from(saasSubscriptionEvents)
        .where(sql`${saasSubscriptionEvents.tenantId} = ${tenantId} and ${saasSubscriptionEvents.fromStatus} = 'paused'`);
      expect(resumeEvent[0]).toMatchObject({ fromPlanId: 'pro', toPlanId: 'standard', fromStatus: 'paused', toStatus: 'active' });
      await changeClinicSubscription({ tenantId, actorUserId: userId, planId: 'pro', status: 'inactive' });
      const cancelled = await db.select().from(clinicSubscriptions).where(sql`${clinicSubscriptions.tenantId} = ${tenantId}`);
      expect(cancelled[0]?.status).toBe('inactive');
      expect(cancelled[0]?.endedAt).toBeTruthy();
      expect((await db.select().from(saasSubscriptionEvents).where(sql`${saasSubscriptionEvents.tenantId} = ${tenantId}`))).toHaveLength(4);
      expect(await getSaasSubscription(tenantId)).toMatchObject({
        effectivePlan: 'free',
        subscription: { planId: 'standard', status: 'inactive' },
      });

      expect(() => validateSaasPlanCapabilities([
        { id: 'free', capabilities: ['patients.read'] },
        { id: 'standard', capabilities: [] },
        { id: 'pro', capabilities: ['patients.read'] },
      ])).toThrow();
      expect(await db.select().from(payments).where(eq(payments.tenantId, tenantId))).toHaveLength(0);
    } finally {
      if (tenantCreated) {
        await db.delete(saasSubscriptionEvents).where(sql`${saasSubscriptionEvents.tenantId} = ${tenantId}`);
        await db.delete(clinicSubscriptions).where(sql`${clinicSubscriptions.tenantId} = ${tenantId}`);
      }
      if (tenantCreated) await db.delete(userTenantMemberships).where(sql`${userTenantMemberships.tenantId} = ${tenantId}`);
      if (userCreated) await db.delete(authUsers).where(sql`${authUsers.id} = ${userId}`);
      if (tenantCreated) await db.delete(tenants).where(sql`${tenants.id} = ${tenantId}`);
    }
  });
});
