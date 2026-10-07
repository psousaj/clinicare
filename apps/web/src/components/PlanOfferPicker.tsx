import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { currency } from '@/lib/format';
import { comboPriceCents, matchesName, minSessionsOf, paginate } from '@/lib/planOffers';
import type { Combo, Procedure } from '@/lib/schemas';
import { cn } from '@/lib/utils';

type Kind = 'procedure' | 'combo';
type PlanOfferPickerProps = {
  procedures: Procedure[];
  combos: Combo[];
  procedureIds: string[];
  comboIds: string[];
  sessions: Record<string, string>;
  onToggleProcedure: (id: string, on: boolean) => void;
  onToggleCombo: (id: string, on: boolean) => void;
  onSessionsChange: (id: string, value: string) => void;
};

const kinds: { kind: Kind; label: string; singular: string; searchLabel: string; empty: string }[] = [
  { kind: 'procedure', label: 'Procedimentos', singular: 'procedimento', searchLabel: 'Buscar procedimentos', empty: 'Cadastre um procedimento antes de montar um plano.' },
  { kind: 'combo', label: 'Combos', singular: 'combo', searchLabel: 'Buscar combos', empty: 'Nenhum combo ativo cadastrado.' },
];

// Escolha de procedimentos avulsos e combos do plano: abas, busca e paginação no próprio componente; os escolhidos ficam sempre visíveis abaixo.
export function PlanOfferPicker({ procedures, combos, procedureIds, comboIds, sessions, onToggleProcedure, onToggleCombo, onSessionsChange }: PlanOfferPickerProps) {
  const [kind, setKind] = useState<Kind>('procedure');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const current = kinds.find((entry) => entry.kind === kind)!;
  const activeCombos = combos.filter((combo) => combo.active !== false);
  const catalog = kind === 'procedure'
    ? procedures.map((procedure) => ({ id: procedure.id, name: procedure.name, checked: procedureIds.includes(procedure.id) }))
    : activeCombos.map((combo) => ({ id: combo.id, name: combo.name, checked: comboIds.includes(combo.id) }));
  const matches = catalog.filter((entry) => matchesName(entry.name, query));
  const visible = paginate(matches, page);
  const procedureName = (id?: string | null) => procedures.find((procedure) => procedure.id === id)?.name ?? 'Procedimento';
  const selectedProcedures = procedures.filter((procedure) => procedureIds.includes(procedure.id));
  const selectedCombos = combos.filter((combo) => comboIds.includes(combo.id));
  const selectedCount = selectedProcedures.length + selectedCombos.length;

  function changeKind(next: Kind) {
    setKind(next);
    setQuery('');
    setPage(0);
  }

  return (
    <div className="plan-picker">
      <div className="plan-picker-kinds" role="group" aria-label="Tipo de oferta">
        {kinds.map((entry) => (
          <button key={entry.kind} type="button" className={cn('plan-picker-kind', entry.kind === kind && 'is-active')} aria-pressed={entry.kind === kind} onClick={() => changeKind(entry.kind)}>{entry.label}</button>
        ))}
      </div>
      <div className="plan-picker-search">
        <Search size={15} aria-hidden="true" />
        <Input
          type="search"
          className="min-h-11 pl-9"
          aria-label={current.searchLabel}
          placeholder={`${current.searchLabel}…`}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setPage(0); }}
          onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }}
        />
      </div>
      <div role="group" aria-label={`${current.label} disponíveis`} className="plan-choice-group">
        {catalog.length === 0 && <p className="plan-choice-empty">{current.empty}</p>}
        {catalog.length > 0 && matches.length === 0 && <p className="plan-choice-empty">Nenhum {current.singular} encontrado para “{query.trim()}”.</p>}
        <div className="plan-choice-list">
          {visible.items.map((entry) => (
            <div key={entry.id} className={cn('plan-choice', entry.checked && 'is-selected')}>
              <Label className="plan-choice-main cursor-pointer">
                <Checkbox checked={entry.checked} onCheckedChange={(value) => (kind === 'procedure' ? onToggleProcedure(entry.id, value === true) : onToggleCombo(entry.id, value === true))} />
                {entry.name}
              </Label>
            </div>
          ))}
        </div>
        {visible.pages > 1 && (
          <nav className="plan-picker-pages" aria-label={`Páginas de ${current.label.toLowerCase()}`}>
            <Button type="button" size="sm" variant="outline" className="min-h-10" disabled={visible.page === 0} onClick={() => setPage(visible.page - 1)}>Anterior</Button>
            <span aria-live="polite">Página {visible.page + 1} de {visible.pages}</span>
            <Button type="button" size="sm" variant="outline" className="min-h-10" disabled={visible.page >= visible.pages - 1} onClick={() => setPage(visible.page + 1)}>Próxima</Button>
          </nav>
        )}
      </div>
      <section className="plan-picker-selected" aria-label="Itens selecionados">
        <h4>Selecionados ({selectedCount})</h4>
        {selectedCount === 0 && <p className="plan-choice-empty">Escolha procedimentos ou combos acima para montar o plano.</p>}
        <ul>
          {selectedProcedures.map((procedure) => (
            <li key={`procedure:${procedure.id}`} className="plan-picked">
              <span className="plan-picked-name"><strong>{procedure.name}</strong><span className="plan-badge">Procedimento</span></span>
              <Label className="plan-sessions">Sessões<Input aria-label={`Sessões de ${procedure.name}`} className="w-20" type="number" min={minSessionsOf(procedure)} value={sessions[procedure.id] ?? String(minSessionsOf(procedure))} onChange={(event) => onSessionsChange(procedure.id, event.target.value)} /></Label>
              <Button type="button" variant="ghost" size="icon-sm" className="size-10" aria-label={`Remover ${procedure.name}`} onClick={() => onToggleProcedure(procedure.id, false)}><X /></Button>
            </li>
          ))}
          {selectedCombos.map((combo) => (
            <li key={`combo:${combo.id}`} className="plan-picked">
              <span className="plan-picked-name">
                <strong>{combo.name}</strong><span className="plan-badge is-combo">Combo</span>
                <small>{combo.items.map((item) => `${procedureName(item.procedureId)} ×${item.sessions ?? item.sessionsOverride ?? 1}`).join(', ') || 'Sem procedimentos'}</small>
                <small>{currency(comboPriceCents(combo))} · sessões definidas no próprio combo</small>
              </span>
              <Button type="button" variant="ghost" size="icon-sm" className="size-10" aria-label={`Remover ${combo.name}`} onClick={() => onToggleCombo(combo.id, false)}><X /></Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
