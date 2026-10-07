// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Combo, Contract, Procedure } from './schemas';
import { PAGE_SIZE, linkedContractIds, matchesName, paginate, suggestedPriceCents } from './planOffers';

const procedure = (id: string, priceCents: number, baseSessions?: number) => ({ id, name: id, priceCents, baseSessions }) as Procedure;
const combo = (id: string, priceCents: number, promotionalPriceCents?: number) => ({ id, name: id, priceCents, promotionalPriceCents, anamnesisIds: [], items: [] }) as Combo;
const contract = (id: string, kind: Contract['kind'], target?: { procedureId?: string; comboId?: string }) => ({ id, title: id, kind, active: true, ...target }) as Contract;

describe('plan offer helpers', () => {
  it('matches names ignoring case and accents', () => {
    expect(matchesName('Bioestimulador de colágeno', 'COLAGENO')).toBe(true);
    expect(matchesName('Botox', 'peel')).toBe(false);
    expect(matchesName('Botox', '  ')).toBe(true);
  });

  it('paginates 8 per page and clamps the requested page', () => {
    const items = Array.from({ length: 20 }, (_, index) => index);
    expect(PAGE_SIZE).toBe(8);
    expect(paginate(items, 0)).toMatchObject({ pages: 3, page: 0, items: items.slice(0, 8) });
    expect(paginate(items, 2).items).toEqual([16, 17, 18, 19]);
    expect(paginate(items, 9).page).toBe(2);
    expect(paginate([], 3)).toMatchObject({ pages: 1, page: 0, items: [] });
  });

  it('suggests the sum of procedure price x sessions plus combo price (promotional first)', () => {
    const procedures = [procedure('a', 1000, 2), procedure('b', 500)];
    const combos = [combo('c', 9000, 7000), combo('d', 3000)];
    expect(suggestedPriceCents({ procedures, combos, procedureIds: ['a', 'b'], comboIds: ['c', 'd'], sessions: { a: '4' } })).toBe(4 * 1000 + 1 * 500 + 7000 + 3000);
    expect(suggestedPriceCents({ procedures, combos, procedureIds: ['a'], comboIds: [], sessions: {} })).toBe(2 * 1000);
    expect(suggestedPriceCents({ procedures, combos, procedureIds: ['a'], comboIds: [], sessions: { a: 'abc' } })).toBe(2 * 1000);
    expect(suggestedPriceCents({ procedures, combos, procedureIds: [], comboIds: [], sessions: {} })).toBe(0);
  });

  it('links contracts to the selected procedures and combos only', () => {
    const contracts = [contract('std', 'standard'), contract('pa', 'procedure', { procedureId: 'a' }), contract('pb', 'procedure', { procedureId: 'b' }), contract('cc', 'combo', { comboId: 'c' }), contract('cd', 'combo', { comboId: 'd' })];
    expect([...linkedContractIds(contracts, ['a'], ['c'])].sort()).toEqual(['cc', 'pa']);
    expect(linkedContractIds(contracts, [], []).size).toBe(0);
  });
});
