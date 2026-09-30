import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Field } from '@/components/Field';
import { FormPage } from '@/components/FormPage';
import { DatePicker } from '@/components/pickers';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { comboForm, parseForm } from '@/lib/forms';
import { currency } from '@/lib/format';
import { proceduresQuery, useCreateCombo, useUpdateCombo } from '@/lib/queries';
import type { Combo, Procedure } from '@/lib/schemas';

const day = (value?: string | null) => value?.slice(0, 10);

// Cadastro e edição de combo na mesma página. Combo promocional exige preço promocional e validade.
export function ComboFormPage({ combo }: { combo?: Combo }) {
  const create = useCreateCombo(), update = useUpdateCombo();
  const procedures = (useQuery(proceduresQuery).data ?? []);
  const [promotional, setPromotional] = useState(combo?.promotionalPriceCents != null);
  const [requireNewAnamnesis, setRequireNewAnamnesis] = useState(combo?.requireNewAnamnesis ?? false);
  const [active, setActive] = useState(combo?.active ?? true);
  const [validFrom, setValidFrom] = useState(day(combo?.validFrom)), [validUntil, setValidUntil] = useState(day(combo?.validUntil));
  const [selected, setSelected] = useState<Record<string, string>>(() => Object.fromEntries((combo?.items ?? []).flatMap((item) => (item.procedureId ? [[item.procedureId, String(item.sessions ?? item.sessionsOverride ?? 1)]] : []))));
  const [price, setPrice] = useState<string | null>(combo ? (combo.priceCents / 100).toFixed(2) : null);
  const integralCents = Object.entries(selected).reduce((total, [id, sessions]) => {
    const procedure = procedures.find((candidate) => candidate.id === id);
    return total + (procedure ? procedure.priceCents * (Number(sessions) || 0) : 0);
  }, 0);
  const integral = (integralCents / 100).toFixed(2);
  const shownPrice = price ?? integral;
  const available = procedures.filter((procedure) => procedure.active !== false || procedure.id in selected);
  const chosen = Object.keys(selected).map((id) => procedures.find((procedure) => procedure.id === id)).filter((procedure): procedure is Procedure => !!procedure);
  return (
    <FormPage
      backTo="/procedimentos"
      backSearch={{ aba: 'combos' }}
      backLabel="Catálogo"
      title={combo ? `Editar · ${combo.name}` : 'Novo combo'}
      submitLabel={combo ? 'Salvar alterações' : 'Salvar combo'}
      onSubmit={(form) => {
        for (const key of ['promo', 'validFrom', 'validUntil']) if (!form.has(key)) form.set(key, '');
        const { price, promo, validFrom, validUntil, ...data } = parseForm(comboForm, form);
        const items = Object.entries(selected).map(([procedureId, sessions]) => ({ procedureId, sessions: Number(sessions) }));
        if (items.some((item) => { const minimum = procedures.find((procedure) => procedure.id === item.procedureId)?.baseSessions ?? 1; return !Number.isInteger(item.sessions) || item.sessions < minimum; })) throw new Error('A quantidade de sessões não pode ser menor que a base do procedimento.');
        if (!items.length) throw new Error('Escolha ao menos um procedimento para o combo.');
        if (price < integralCents) throw new Error(`O preço do combo não pode ser menor que o valor integral (${currency(integralCents)}).`);
        if (promotional && promo !== null && promo > price) throw new Error('O preço promocional não pode ser maior que o preço do combo.');
        if (promotional && (promo === null || !validUntil)) throw new Error('Combo promocional exige preço promocional e validade.');
        const body = { ...data, priceCents: price, items, requireNewAnamnesis, promotionalPriceCents: promotional ? promo : null, validFrom: promotional ? validFrom : null, validUntil: promotional ? validUntil : null };
        return combo ? update.mutateAsync({ ...body, id: combo.id, active }) : create.mutateAsync(body);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="name" required autoFocus defaultValue={combo?.name} />
        <Field label="Preço do combo R$" name="price" type="number" min={integral} step="0.01" required value={shownPrice} onChange={(event) => setPrice(event.target.value)} />
      </div>
      <Field label="Descrição" name="description" defaultValue={combo?.description ?? ''} />
      <p className="-mt-2 text-xs text-muted-foreground">Valor integral: {currency(integralCents)} (preço de cada procedimento × sessões). O preço do combo começa nesse valor e só pode ser aumentado.</p>
      <section aria-label="Procedimentos do combo" className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Procedimentos do combo</span>
          {procedures.length === 0 ? (
            <Button asChild type="button" variant="outline" size="sm"><Link to="/procedimentos/novo"><Plus /> Cadastrar procedimento</Link></Button>
          ) : (
            <ProcedurePicker options={available.filter((procedure) => !(procedure.id in selected))} onPick={(procedure) => setSelected((current) => ({ ...current, [procedure.id]: String(procedure.baseSessions ?? 1) }))} />
          )}
        </div>
        {chosen.length === 0 && <p className="m-0 rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{procedures.length === 0 ? 'Cadastre um procedimento antes de montar o combo.' : 'Adicione um procedimento para montar o combo.'}</p>}
        {chosen.map((procedure) => {
          const sessions = Number(selected[procedure.id]) || 0;
          return (
            <div key={procedure.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
              <div className="min-w-40 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {procedure.name}
                  {procedure.standalone === false && <StatusBadge tone="warning">Só em combo/plano</StatusBadge>}
                  {procedure.active === false && <StatusBadge tone="neutral">Inativo</StatusBadge>}
                </div>
                <div className="text-xs text-muted-foreground">{procedure.durationMinutes ?? 60} min por sessão · {currency(procedure.priceCents)} por sessão</div>
              </div>
              <Input
                aria-label={`Sessões de ${procedure.name}`}
                className="w-24"
                type="number"
                min={procedure.baseSessions ?? 1}
                value={selected[procedure.id] ?? ''}
                onChange={(event) => setSelected((current) => ({ ...current, [procedure.id]: event.target.value }))}
              />
              <span className="w-28 text-right text-sm font-semibold">{currency(procedure.priceCents * sessions)}</span>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${procedure.name}`} onClick={() => setSelected(({ [procedure.id]: _removed, ...rest }) => rest)}><Trash2 /></Button>
            </div>
          );
        })}
      </section>
      <Label className="cursor-pointer">
        <Checkbox checked={promotional} onCheckedChange={(value) => setPromotional(value === true)} />
        Combo promocional
      </Label>
      {promotional && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Preço promocional R$" name="promo" type="number" min="0" max={shownPrice} step="0.01" required defaultValue={combo?.promotionalPriceCents != null ? (combo.promotionalPriceCents / 100).toFixed(2) : undefined} />
          <Field label="Válido a partir de"><DatePicker value={validFrom} onChange={setValidFrom} name="validFrom" /></Field>
          <Field label="Válido até"><DatePicker value={validUntil} onChange={setValidUntil} name="validUntil" /></Field>
        </div>
      )}
      <Label className="cursor-pointer">
        <Checkbox checked={requireNewAnamnesis} onCheckedChange={(value) => setRequireNewAnamnesis(value === true)} />
        Exigir nova anamnese a cada acompanhamento, mesmo que a última ainda esteja válida
      </Label>
      {combo && (
        <Label className="cursor-pointer">
          <Checkbox checked={active} onCheckedChange={(value) => setActive(value === true)} />
          Ativo — disponível para novos acompanhamentos (acompanhamentos já iniciados não mudam)
        </Label>
      )}
    </FormPage>
  );
}

// Busca entre os procedimentos cadastrados e adiciona ao combo.
function ProcedurePicker({ options, onPick }: { options: Procedure[]; onPick: (procedure: Procedure) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const matches = options.filter((procedure) => procedure.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(''); }}>
      <PopoverTrigger asChild><Button type="button" variant="outline" size="sm"><Plus /> Adicionar procedimento</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <label className="mb-2 flex items-center gap-2 rounded-md border border-border px-2">
          <Search className="size-4 text-muted-foreground" />
          <input autoFocus className="h-8 flex-1 border-0 bg-transparent text-sm outline-none" placeholder="Buscar procedimento" aria-label="Buscar procedimento" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="grid max-h-64 gap-1 overflow-y-auto">
          {matches.length === 0 && <p className="m-0 p-3 text-center text-sm text-muted-foreground">{options.length === 0 ? 'Todos os procedimentos já foram adicionados.' : 'Nenhum procedimento encontrado.'}</p>}
          {matches.map((procedure) => (
            <button key={procedure.id} type="button" className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1.5 text-left hover:bg-muted" onClick={() => { onPick(procedure); setOpen(false); setQuery(''); }}>
              <span className="block text-sm font-medium">{procedure.name}</span>
              <span className="block text-xs text-muted-foreground">{procedure.durationMinutes ?? 60} min · {currency(procedure.priceCents)} por sessão{procedure.standalone === false ? ' · só em combo/plano' : ''}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
