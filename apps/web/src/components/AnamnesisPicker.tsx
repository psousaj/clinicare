import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { matchesName } from '@/lib/planOffers';
import type { Anamnesis, Combo, Procedure } from '@/lib/schemas';

// Escolha de formulários de anamnese de uma oferta: busca e lista com os vinculados sempre visíveis.
export function AnamnesisPicker({ forms, pickedIds, onToggle }: { forms: Anamnesis[]; pickedIds: string[]; onToggle: (id: string, on: boolean) => void }) {
  const [query, setQuery] = useState('');
  const matches = forms.filter((form) => matchesName(form.title, query));
  const selected = forms.filter((form) => pickedIds.includes(form.id));
  return (
    <div className="grid gap-2">
      <div className="plan-picker-search">
        <Search size={15} aria-hidden="true" />
        <Input
          type="search"
          className="min-h-11 pl-9"
          aria-label="Buscar formulários de anamnese"
          placeholder="Buscar formulários de anamnese…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault(); }}
        />
      </div>
      <div role="group" aria-label="Formulários de anamnese disponíveis" className="plan-choice-group">
        {forms.length === 0 && <p className="plan-choice-empty">Nenhum formulário cadastrado.</p>}
        {forms.length > 0 && matches.length === 0 && <p className="plan-choice-empty">Nenhum formulário encontrado para “{query.trim()}”.</p>}
        <div className="plan-choice-list">
          {matches.map((form) => (
            <div key={form.id} className={pickedIds.includes(form.id) ? 'plan-choice is-selected' : 'plan-choice'}>
              <Label className="plan-choice-main cursor-pointer">
                <Checkbox checked={pickedIds.includes(form.id)} onCheckedChange={(value) => onToggle(form.id, value === true)} />
                {form.title}
              </Label>
            </div>
          ))}
        </div>
      </div>
      {selected.length > 0 && (
        <section className="plan-picker-selected" aria-label="Anamneses vinculadas">
          <h4>Vinculadas ({selected.length})</h4>
          <ul>
            {selected.map((form) => (
              <li key={form.id} className="plan-picked">
                <span className="plan-picked-name"><strong>{form.title}</strong></span>
                <Button type="button" variant="ghost" size="icon-sm" className="size-10" aria-label={`Remover ${form.title}`} onClick={() => onToggle(form.id, false)}><X /></Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Formulários herdados dos procedimentos da oferta (avulsos e de dentro dos combos): entram na inscrição junto com os vinculados acima.
export function InheritedAnamneses({ procedures, combos, forms, procedureIds, comboIds, pickedIds }: { procedures: Procedure[]; combos: Combo[]; forms: Anamnesis[]; procedureIds: string[]; comboIds: string[]; pickedIds: string[] }) {
  const inherited = useMemo(() => {
    const seen = new Map<string, string>();
    const push = (procedureId: string, origin: string) => {
      for (const formId of procedures.find((procedure) => procedure.id === procedureId)?.anamnesisIds ?? []) {
        if (!pickedIds.includes(formId) && !seen.has(formId)) seen.set(formId, origin);
      }
    };
    for (const id of procedureIds) push(id, procedures.find((procedure) => procedure.id === id)?.name ?? 'Procedimento');
    for (const comboId of comboIds) {
      const combo = combos.find((entry) => entry.id === comboId);
      for (const item of combo?.items ?? []) if (typeof item.procedureId === 'string') push(item.procedureId, combo?.name ?? 'Combo');
    }
    return [...seen].map(([formId, origin]) => ({ title: forms.find((form) => form.id === formId)?.title ?? 'Formulário', origin }));
  }, [procedures, combos, forms, procedureIds, comboIds, pickedIds]);
  if (!inherited.length) return null;
  return <p className="m-0 text-xs text-muted-foreground">Também exigidas pelos procedimentos: {inherited.map((entry) => `${entry.title} (via ${entry.origin})`).join('; ')}.</p>;
}
