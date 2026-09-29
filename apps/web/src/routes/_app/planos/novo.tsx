import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Field } from '@/components/Field';
import { FormPage } from '@/components/FormPage';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { parseForm, planForm } from '@/lib/forms';
import { combosQuery, contractsQuery, proceduresQuery, useCreatePlan } from '@/lib/queries';

export const Route = createFileRoute('/_app/planos/novo')({ component: NewPlan });

function toggle(list: string[], id: string, on: boolean) {
  return on ? [...list, id] : list.filter((item) => item !== id);
}

function NewPlan() {
  const create = useCreatePlan();
  const procedures = useQuery(proceduresQuery).data ?? [], combos = useQuery(combosQuery).data ?? [], contracts = useQuery(contractsQuery).data ?? [];
  const [procedureIds, setProcedureIds] = useState<string[]>([]), [comboIds, setComboIds] = useState<string[]>([]), [contractIds, setContractIds] = useState<string[]>([]);
  const [requireNewAnamnesis, setRequireNewAnamnesis] = useState(false);
  return (
    <FormPage
      backTo="/planos"
      backLabel="Planos"
      title="Novo plano"
      submitLabel="Salvar plano"
      onSubmit={(form) => {
        const { price, ...data } = parseForm(planForm, form);
        const items = [...procedureIds.map((offerId) => ({ offerType: 'procedure', offerId })), ...comboIds.map((offerId) => ({ offerType: 'combo', offerId }))];
        if (!items.length) throw new Error('Escolha ao menos um procedimento ou combo para o plano.');
        return create.mutateAsync({ ...data, priceCents: price, items, contractIds, requireNewAnamnesis });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="name" required autoFocus />
        <Field label="Preço do plano R$" name="price" type="number" min="0" step="0.01" required />
      </div>
      <Field label="Descrição" name="description" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Duração (dias)" name="durationDays" type="number" min="1" placeholder="Opcional" />
        <Field label="Validade (dias após contratar)" name="validityDays" type="number" min="1" placeholder="Opcional" />
      </div>
      <Group label="Procedimentos do plano" empty="Cadastre um procedimento antes de montar um plano." items={procedures.map((procedure) => ({ id: procedure.id, name: procedure.name }))} selected={procedureIds} onToggle={(id, on) => setProcedureIds((list) => toggle(list, id, on))} />
      {combos.length > 0 && <Group label="Combos do plano" items={combos.map((combo) => ({ id: combo.id, name: combo.name }))} selected={comboIds} onToggle={(id, on) => setComboIds((list) => toggle(list, id, on))} />}
      <Group label="Contratos do plano" hint="O contrato padrão e os contratos dos procedimentos e combos são incluídos automaticamente." empty="Nenhum contrato cadastrado." items={contracts.filter((contract) => contract.kind !== 'standard').map((contract) => ({ id: contract.id, name: contract.title }))} selected={contractIds} onToggle={(id, on) => setContractIds((list) => toggle(list, id, on))} />
      <Label className="cursor-pointer">
        <Checkbox checked={requireNewAnamnesis} onCheckedChange={(value) => setRequireNewAnamnesis(value === true)} />
        Exigir nova anamnese ao contratar, mesmo que a última ainda esteja válida
      </Label>
    </FormPage>
  );
}

function Group({ label, hint, empty, items, selected, onToggle }: { label: string; hint?: string; empty?: string; items: { id: string; name: string }[]; selected: string[]; onToggle: (id: string, on: boolean) => void }) {
  return (
    <div role="group" aria-label={label} className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {items.length === 0 && empty && <p className="m-0 text-sm text-muted-foreground">{empty}</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((item) => (
          <Label key={item.id} className="cursor-pointer">
            <Checkbox checked={selected.includes(item.id)} onCheckedChange={(value) => onToggle(item.id, value === true)} />
            {item.name}
          </Label>
        ))}
      </div>
    </div>
  );
}
