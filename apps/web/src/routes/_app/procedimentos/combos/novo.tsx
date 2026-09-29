import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Field } from '@/components/Field';
import { FormPage } from '@/components/FormPage';
import { DatePicker } from '@/components/pickers';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { comboForm, parseForm } from '@/lib/forms';
import { proceduresQuery, useCreateCombo } from '@/lib/queries';

export const Route = createFileRoute('/_app/procedimentos/combos/novo')({ component: NewCombo });

function NewCombo() {
  const create = useCreateCombo();
  const procedures = useQuery(proceduresQuery).data ?? [];
  const [promotional, setPromotional] = useState(false);
  const [validFrom, setValidFrom] = useState<string>(), [validUntil, setValidUntil] = useState<string>();
  const [selected, setSelected] = useState<Record<string, string>>({});
  return (
    <FormPage
      backTo="/procedimentos"
      backLabel="Procedimentos"
      title="Novo combo"
      submitLabel="Salvar combo"
      onSubmit={(form) => {
        for (const key of ['promo', 'validFrom', 'validUntil']) if (!form.has(key)) form.set(key, '');
        const { price, promo, validFrom, validUntil, ...data } = parseForm(comboForm, form);
        const items = Object.entries(selected).map(([procedureId, sessions]) => ({ procedureId, sessionsOverride: Number(sessions) || null }));
        if (!items.length) throw new Error('Escolha ao menos um procedimento para o combo.');
        if (promotional && (promo === null || !validUntil)) throw new Error('Combo promocional exige preço promocional e validade.');
        return create.mutateAsync({ ...data, priceCents: price, items, ...(promotional && { promotionalPriceCents: promo, validFrom, validUntil }) });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="name" required autoFocus />
        <Field label="Preço do combo R$" name="price" type="number" min="0" step="0.01" required />
      </div>
      <div role="group" aria-label="Procedimentos do combo" className="grid gap-2">
        <span className="text-sm font-medium">Procedimentos do combo</span>
        {procedures.length === 0 && <p className="text-sm text-muted-foreground">Cadastre um procedimento antes de montar um combo.</p>}
        {procedures.map((procedure) => {
          const checked = procedure.id in selected;
          return (
            <div key={procedure.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <Label className="flex-1 cursor-pointer">
                <Checkbox checked={checked} onCheckedChange={(value) => setSelected(({ [procedure.id]: _removed, ...rest }) => (value === true ? { ...rest, [procedure.id]: '' } : rest))} />
                {procedure.name}
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
          <Field label="Preço promocional R$" name="promo" type="number" min="0" step="0.01" required />
          <Field label="Válido a partir de">
            <DatePicker value={validFrom} onChange={setValidFrom} name="validFrom" />
          </Field>
          <Field label="Válido até">
            <DatePicker value={validUntil} onChange={setValidUntil} name="validUntil" />
          </Field>
        </div>
      )}
    </FormPage>
  );
}
