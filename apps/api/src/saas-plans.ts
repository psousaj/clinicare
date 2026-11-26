import { and, desc, eq, isNull } from 'drizzle-orm';
import { clinicSubscriptions, getDatabase, saasPlans, saasSubscriptionEvents, userTenantMemberships } from '@clinicare/db';

export const SAAS_PLAN_ORDER = ['free', 'standard', 'pro'] as const;
export type SaasPlanId = (typeof SAAS_PLAN_ORDER)[number];
export type SaasCapability =
  | 'dashboard.upcoming_sessions'
  | 'dashboard.recent_patients'
  | 'patients.crud'
  | 'attendances.single_sessions'
  | 'appointments.single_sessions'
  | 'catalog.single_procedures'
  | 'anamnesis.in_clinic'
  | 'finance.single_session_payments'
  | 'contracts.docx_import'
  | 'documents.historical_read'
  | 'settings.clinic_account'
  | 'dashboard.document_tasks'
  | 'patient.session_photos'
  | 'patient.custom_fields'
  | 'followups'
  | 'appointments.followup_sessions'
  | 'catalog.combos'
  | 'catalog.clinical_plans'
  | 'anamnesis.public_links'
  | 'contracts.generation'
  | 'contracts.patient_signatures'
  | 'finance.followups'
  | 'events'
  | 'patient.relationship_indicators'
  | 'signatures.govbr';

const planRank: Record<SaasPlanId, number> = { free: 0, standard: 1, pro: 2 };

export function validateSaasPlanCapabilities(plans: readonly { id: SaasPlanId; capabilities: readonly string[] }[]) {
  const byId = new Map(plans.map((plan) => [plan.id, new Set(plan.capabilities)]));
  for (const id of SAAS_PLAN_ORDER) {
    if (!byId.has(id)) throw new Error(`Missing SaaS plan ${id}.`);
  }
  if (byId.size !== plans.length) throw new Error('Duplicate SaaS plan identifier.');
  for (const plan of plans) {
    const lower = SAAS_PLAN_ORDER.slice(0, planRank[plan.id]);
    for (const lowerPlanId of lower) {
      for (const capability of byId.get(lowerPlanId) ?? []) {
        if (!byId.get(plan.id)?.has(capability)) {
          throw new Error(`${plan.id} must include ${capability} from ${lowerPlanId}.`);
        }
      }
    }
  }
}

export function effectiveSaasPlan(input: { planId: SaasPlanId; status: 'active' | 'paused' | 'inactive' } | null): SaasPlanId {
  if (!input || input.status !== 'active') return 'free';
  return input.planId;
}

export async function listSaasPlans() {
  const rows = await getDatabase().select().from(saasPlans).orderBy(saasPlans.rank);
  validateSaasPlanCapabilities(rows.map((row) => ({ id: row.id as SaasPlanId, capabilities: row.capabilities ?? [] })));
  return rows.filter((row) => row.available);
}

export async function getSaasSubscription(tenantId: string) {
  const db = getDatabase();
  const [subscription] = await db.select({
    planId: clinicSubscriptions.planId,
    status: clinicSubscriptions.status,
    startedAt: clinicSubscriptions.startedAt,
    endedAt: clinicSubscriptions.endedAt,
  }).from(clinicSubscriptions)
    .where(eq(clinicSubscriptions.tenantId, tenantId))
    .orderBy(desc(clinicSubscriptions.createdAt))
    .limit(1);
  return {
    effectivePlan: effectiveSaasPlan(subscription as { planId: SaasPlanId; status: 'active' | 'paused' | 'inactive' } | null),
    subscription: subscription ?? null,
  };
}

export async function getClinicSaasPlan(tenantId: string) {
  return (await getSaasSubscription(tenantId)).effectivePlan;
}

export async function changeClinicSubscription(input: {
  tenantId: string;
  actorUserId: string;
  planId: SaasPlanId;
  status: 'active' | 'paused' | 'inactive';
}) {
  return getDatabase().transaction(async (tx) => {
    const [membership] = await tx.select({ id: userTenantMemberships.userId, role: userTenantMemberships.role })
      .from(userTenantMemberships)
      .where(and(eq(userTenantMemberships.tenantId, input.tenantId), eq(userTenantMemberships.userId, input.actorUserId)));
    if (!membership || membership.role !== 'admin') throw new Error('Aktor sem vínculo administrativo com a clínica.');

    const [targetPlan] = await tx.select().from(saasPlans).where(eq(saasPlans.id, input.planId));
    if (!targetPlan || (input.status !== 'inactive' && (!targetPlan.available || targetPlan.id === 'free'))) {
      throw new Error('Plano indisponível para concessão comercial.');
    }
    const [current] = await tx.select().from(clinicSubscriptions)
      .where(and(eq(clinicSubscriptions.tenantId, input.tenantId), isNull(clinicSubscriptions.endedAt)))
      .for('update');

    const now = new Date();
    if (!current || current.status === 'inactive') {
      if (current) await tx.update(clinicSubscriptions).set({ endedAt: now }).where(eq(clinicSubscriptions.id, current.id));
      const [created] = await tx.insert(clinicSubscriptions).values({
        tenantId: input.tenantId, planId: input.planId, status: input.status, startedAt: now,
      }).returning();
      await tx.insert(saasSubscriptionEvents).values({
        tenantId: input.tenantId, subscriptionId: created!.id, actorUserId: input.actorUserId,
        fromPlanId: current?.planId ?? null, toPlanId: input.planId, fromStatus: current?.status ?? null, toStatus: input.status,
      });
      return created!;
    }

    if (input.status === 'inactive') {
      const [ended] = await tx.update(clinicSubscriptions).set({
        status: 'inactive', endedAt: now,
      }).where(eq(clinicSubscriptions.id, current.id)).returning();
      await tx.insert(saasSubscriptionEvents).values({
        tenantId: input.tenantId, subscriptionId: ended!.id, actorUserId: input.actorUserId,
        fromPlanId: current.planId, toPlanId: current.planId, fromStatus: current.status, toStatus: 'inactive',
      });
      return ended!;
    }

    if (current.status === 'paused' && input.status === 'active') {
      const [restored] = await tx.update(clinicSubscriptions).set({ planId: input.planId, status: 'active' })
        .where(eq(clinicSubscriptions.id, current.id)).returning();
      await tx.insert(saasSubscriptionEvents).values({
        tenantId: input.tenantId, subscriptionId: restored!.id, actorUserId: input.actorUserId,
        fromPlanId: current.planId, toPlanId: input.planId, fromStatus: 'paused', toStatus: 'active',
      });
      return restored!;
    }

    const [created] = await tx.update(clinicSubscriptions).set({
      planId: input.planId, status: input.status,
    }).where(eq(clinicSubscriptions.id, current.id)).returning();
    await tx.insert(saasSubscriptionEvents).values({
      tenantId: input.tenantId, subscriptionId: created!.id, actorUserId: input.actorUserId,
      fromPlanId: current.planId, toPlanId: input.planId, fromStatus: current.status, toStatus: input.status,
    });
    return created!;
  });
}
