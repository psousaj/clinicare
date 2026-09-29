import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Field } from '@/components/Field';
import { FormPage } from '@/components/FormPage';
import { DatePicker } from '@/components/pickers';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { comboForm, parseForm } from '@/lib/forms';
import { currency } from '@/lib/format';
import { proceduresQuery, useCreateCombo, useUpdateCombo } from '@/lib/queries';
import type { Combo } from '@/lib/schemas';

const day = (value?: string | null) => value?.slice(0, 10);

// Cadastro e edição de combo na mesma página. Combo promocional exige preço promocional e validade.
export function ComboFormPage({ combo }: { combo?: Combo }) {
  const create = useCreateCombo(), update = useUpdateCombo();
  const procedures = (useQuery(proceduresQuery).data ?? []);
  const [promotional, setPromotional] = useState(combo?.promotionalPriceCents != null);
  const [requireNewAnamnesis, setRequireNewAnamnesis] = useState(combo?.requireNewAnamnesis ?? false);
  const [active, setActive] = useState(combo?.active ?? true);
  const [validFrom, setValidFrom] = useState(day(combo?.validFrom)), [validUntil, setValidUntil] = useState(day(combo?.validUntil));
  const [selected, setSelected] = useState<Record<string, string>>(() => Object.fromEntries((combo?.items ?? []).flatMap((item) => (item.procedureId ? [[item.procedureId, item.sessionsOverride ? String(item.sessionsOverride) : '']] : []))));
  const [price, setPrice] = useState<string | null>(combo ? (combo.priceCents / 100).toFixed(2) : null);
  const integralCents = Object.entries(selected).reduce((total, [id, sessions]) => {
    const procedure = procedures.find((candidate) => candidate.id === id);
    return total + (procedure ? procedure.priceCents * (Number(sessions) || procedure.baseSessions) : 0);
  }, 0);
  const integral = (integralCents / 100).toFixed(2);
  const shownPrice = price ?? integral;
  const available = procedures.filter((procedure) => procedure.active !== false || procedure.id in selected);
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
        const items = Object.entries(selected).map(([procedureId, sessions]) => ({ procedureId, sessionsOverride: Number(sessions) || null }));
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
      <div role="group" aria-label="Procedimentos do combo" className="grid gap-2">
        <span className="text-sm font-medium">Procedimentos do combo</span>
        {available.length === 0 && <p className="text-sm text-muted-foreground">Cadastre um procedimento antes de montar um combo.</p>}
        {available.map((procedure) => {
          const checked = procedure.id in selected;
          return (
            <div key={procedure.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
              <Label className="flex-1 cursor-pointer">
                <Checkbox checked={checked} onCheckedChange={(value) => setSelected(({ [procedure.id]: _removed, ...rest }) => (value === true ? { ...rest, [procedure.id]: '' } : rest))} />
                {procedure.name}{procedure.active === false && <span className="text-xs text-muted-foreground"> (inativo)</span>}
              </Label>
              <Input
                aria-label={`Sessões de ${procedure.name}`}
                className="w-56"
                type="number"
                min="1"
                placeholder={`Sessões (padrão ${procedure.baseSessions})`}
                disabled={!checked}
                value={selected[procedure.id] ?? ''}
                onChange={(event) => setSelected((current) => ({ ...current, [procedure.id]: event.target.value }))}
              />
            </div>
          );
        })}
      </div>
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
