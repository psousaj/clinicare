import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { Field } from '@/components/Field';
import { FormPage } from '@/components/FormPage';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { parseForm, planForm } from '@/lib/forms';
import { contractsQuery, plansQuery, proceduresQuery, useCreatePlan, useUpdatePlan } from '@/lib/queries';

export const Route = createFileRoute('/_app/planos/novo')({ validateSearch: z.object({ planId: z.string().optional() }), component: NewPlan });

function toggle(list: string[], id: string, on: boolean) {
  return on ? [...list, id] : list.filter((item) => item !== id);
}

function NewPlan() {
  const { planId } = Route.useSearch();
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const procedures = useQuery(proceduresQuery).data ?? [], contracts = useQuery(contractsQuery).data ?? [];
  const existing = useQuery({ ...plansQuery, enabled: Boolean(planId) }).data?.find((plan) => plan.id === planId);
  const [procedureIds, setProcedureIds] = useState<string[]>([]), [contractIds, setContractIds] = useState<string[]>([]);
  const [procedureSessions, setProcedureSessions] = useState<Record<string, string>>({});
  const [requireNewAnamnesis, setRequireNewAnamnesis] = useState(false);
  useEffect(() => {
    if (!existing) return;
    setProcedureIds(existing.items.map((item) => item.offerId));
    setContractIds(existing.contractIds);
    setProcedureSessions(Object.fromEntries(existing.items.map((item) => [item.offerId, String(item.sessions)])));
    setRequireNewAnamnesis(existing.requireNewAnamnesis === true);
  }, [existing]);
  return (
    <FormPage
      backTo="/planos"
      backLabel="Planos"
      title={planId ? `Editar · ${existing?.name ?? 'Plano'}` : 'Novo plano'}
      submitLabel="Salvar plano"
      onSubmit={(form) => {
        const { price, ...data } = parseForm(planForm, form);
        const items = procedureIds.map((offerId) => ({ offerType: 'procedure' as const, offerId, sessions: Number(procedureSessions[offerId] ?? procedures.find((procedure) => procedure.id === offerId)?.baseSessions ?? 1) }));
        if (procedureIds.some((id) => { const minimum = procedures.find((procedure) => procedure.id === id)?.baseSessions ?? 1; return !Number.isInteger(Number(procedureSessions[id] ?? minimum)) || Number(procedureSessions[id] ?? minimum) < minimum; })) throw new Error('A quantidade de sessões não pode ser menor que a base do procedimento.');
        if (!items.length) throw new Error('Escolha ao menos um procedimento para o plano.');
        return planId ? update.mutateAsync({ id: planId, ...data, priceCents: price, items, contractIds, requireNewAnamnesis }) : create.mutateAsync({ ...data, priceCents: price, items, contractIds, requireNewAnamnesis });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="name" required autoFocus defaultValue={existing?.name} />
        <Field label="Preço do plano R$" name="price" type="number" min="0" step="0.01" required defaultValue={existing ? (existing.priceCents / 100).toFixed(2) : undefined} />
      </div>
      <Field label="Descrição" name="description" defaultValue={existing?.description ?? ''} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Duração (dias)" name="durationDays" type="number" min="1" placeholder="Opcional" defaultValue={existing?.durationDays ?? ''} />
        <Field label="Validade (dias após contratar)" name="validityDays" type="number" min="1" placeholder="Opcional" defaultValue={existing?.validityDays ?? ''} />
      </div>
      <Group label="Procedimentos do plano" empty="Cadastre um procedimento antes de montar um plano." items={procedures.map((procedure) => ({ id: procedure.id, name: procedure.name, minSessions: procedure.baseSessions ?? 1 }))} selected={procedureIds} sessions={procedureSessions} onSessionsChange={(id, value) => setProcedureSessions((current) => ({ ...current, [id]: value }))} onToggle={(id, on) => setProcedureIds((list) => toggle(list, id, on))} />
      <Group label="Contratos do plano" hint="O contrato padrão e os contratos dos procedimentos e combos são incluídos automaticamente." empty="Nenhum contrato cadastrado." items={contracts.filter((contract) => contract.kind !== 'standard').map((contract) => ({ id: contract.id, name: contract.title }))} selected={contractIds} onToggle={(id, on) => setContractIds((list) => toggle(list, id, on))} />
      <Label className="cursor-pointer">
        <Checkbox checked={requireNewAnamnesis} onCheckedChange={(value) => setRequireNewAnamnesis(value === true)} />
        Exigir nova anamnese ao contratar, mesmo que a última ainda esteja válida
      </Label>
    </FormPage>
  );
}

function Group({ label, hint, empty, items, selected, sessions, onSessionsChange, onToggle }: { label: string; hint?: string; empty?: string; items: { id: string; name: string; minSessions?: number }[]; selected: string[]; sessions?: Record<string, string>; onSessionsChange?: (id: string, value: string) => void; onToggle: (id: string, on: boolean) => void }) {
  return (
    <div role="group" aria-label={label} className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {items.length === 0 && empty && <p className="m-0 text-sm text-muted-foreground">{empty}</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-2">
            <Label className="cursor-pointer">
              <Checkbox checked={selected.includes(item.id)} onCheckedChange={(value) => { onToggle(item.id, value === true); if (value === true && onSessionsChange) onSessionsChange(item.id, String(item.minSessions ?? 1)); }} />
              {item.name}
            </Label>
            {selected.includes(item.id) && onSessionsChange && <Label className="flex-row items-center gap-2 text-xs text-muted-foreground">Sessões<Input aria-label={`Sessões de ${item.name}`} className="w-20" type="number" min={item.minSessions ?? 1} value={sessions?.[item.id] ?? String(item.minSessions ?? 1)} onChange={(event) => onSessionsChange(item.id, event.target.value)} /></Label>}
          </div>
        ))}
      </div>
    </div>
  );
}
