import type { Combo, Contract, Procedure } from './schemas';

export const PAGE_SIZE = 8;

const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const matchesName = (name: string, query: string) => fold(name).includes(fold(query));

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(page, 0), pages - 1);
  return { pages, page: current, items: items.slice(current * size, (current + 1) * size) };
}

export const minSessionsOf = (procedure: Procedure) => procedure.baseSessions ?? 1;
export const comboPriceCents = (combo: Combo) => combo.promotionalPriceCents ?? combo.priceCents;

// Sessões digitadas inválidas (vazio, texto) voltam ao mínimo do procedimento, como na validação do envio.
export function sessionsFor(procedure: Procedure, sessions: Record<string, string>) {
  const typed = Number(sessions[procedure.id]);
  return Number.isInteger(typed) && typed >= 1 ? typed : minSessionsOf(procedure);
}

// Preço sugerido do plano: procedimentos avulsos (preço × sessões) mais o preço de cada combo.
export function suggestedPriceCents({ procedures, combos, procedureIds, comboIds, sessions }: { procedures: Procedure[]; combos: Combo[]; procedureIds: string[]; comboIds: string[]; sessions: Record<string, string> }) {
  const procedureTotal = procedures.filter((procedure) => procedureIds.includes(procedure.id)).reduce((sum, procedure) => sum + procedure.priceCents * sessionsFor(procedure, sessions), 0);
  const comboTotal = combos.filter((combo) => comboIds.includes(combo.id)).reduce((sum, combo) => sum + comboPriceCents(combo), 0);
  return procedureTotal + comboTotal;
}

// Contratos específicos dos itens escolhidos: entram marcados na lista do plano (o profissional pode desmarcar).
export function linkedContractIds(contracts: Contract[], procedureIds: string[], comboIds: string[]) {
  return new Set(contracts.filter((contract) => (contract.kind === 'procedure' && !!contract.procedureId && procedureIds.includes(contract.procedureId)) || (contract.kind === 'combo' && !!contract.comboId && comboIds.includes(contract.comboId))).map((contract) => contract.id));
}
