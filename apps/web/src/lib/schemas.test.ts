// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { planSchema } from './schemas';

const base = { id: 'p1', name: 'Plano', priceCents: 1000, contractIds: ['c1'] };

describe('planSchema items', () => {
  it('parses procedure and combo items with their own shapes', () => {
    const plan = planSchema.parse({
      ...base,
      items: [
        { offerType: 'procedure', offerId: 'proc1', sessions: 3, procedureName: 'Botox' },
        { offerType: 'combo', offerId: 'combo1', comboName: 'Facial', priceCents: 500, items: [{ procedureId: 'proc2', procedureName: 'Peeling', sessions: 2 }] },
      ],
    });
    expect(plan.items[0]).toMatchObject({ offerType: 'procedure', sessions: 3 });
    expect(plan.items[1]).toMatchObject({ offerType: 'combo', comboName: 'Facial' });
    const combo = plan.items[1]!;
    if (combo.offerType !== 'combo') throw new Error('expected combo item');
    expect(combo.items[0]?.sessions).toBe(2);
  });

  it('keeps legacy procedure items valid and defaults their sessions', () => {
    const plan = planSchema.parse({ ...base, items: [{ offerType: 'procedure', offerId: 'proc1' }] });
    expect(plan.items[0]).toMatchObject({ offerType: 'procedure', sessions: 1 });
  });

  it('defaults a combo item without frozen items to an empty list', () => {
    const plan = planSchema.parse({ ...base, items: [{ offerType: 'combo', offerId: 'combo1' }] });
    expect(plan.items[0]).toMatchObject({ offerType: 'combo', items: [] });
  });

  it('rejects an unknown offer type', () => {
    expect(planSchema.safeParse({ ...base, items: [{ offerType: 'plan', offerId: 'x' }] }).success).toBe(false);
  });
});
