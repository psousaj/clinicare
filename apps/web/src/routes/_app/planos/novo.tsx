import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useEffect, useState, type ReactNode } from 'react';
import { CalendarDays, ClipboardList, FileText, Layers3, Stethoscope } from 'lucide-react';
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
      className="plan-form-page"
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
      <div className="plan-intro"><span className="plan-intro-mark"><Layers3 size={19} /></span><div><p>Monte uma oferta completa</p><span>Defina o valor e reúna os procedimentos e documentos que fazem parte deste plano.</span></div></div>
      <section className="plan-section">
        <SectionHeading icon={<ClipboardList size={17} />} title="Informações do plano" detail="Dê um nome fácil de reconhecer e defina as condições principais." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome do plano" name="name" required autoFocus placeholder="Ex.: Plano de cuidados faciais" defaultValue={existing?.name} />
          <Field label="Preço do plano (R$)" name="price" type="number" min="0" step="0.01" required placeholder="0,00" defaultValue={existing ? (existing.priceCents / 100).toFixed(2) : undefined} />
        </div>
        <Field label="Descrição" name="description" placeholder="Conte em poucas palavras o que está incluído" defaultValue={existing?.description ?? ''} />
        <div className="plan-timing"><div className="plan-timing-title"><CalendarDays size={16} /><span>Prazos <small>opcionais</small></span></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Duração do tratamento (dias)" name="durationDays" type="number" min="1" placeholder="Sem prazo definido" defaultValue={existing?.durationDays ?? ''} />
            <Field label="Validade após contratação (dias)" name="validityDays" type="number" min="1" placeholder="Sem prazo definido" defaultValue={existing?.validityDays ?? ''} />
          </div>
        </div>
      </section>
      <section className="plan-section">
        <SectionHeading icon={<Stethoscope size={17} />} title="Procedimentos incluídos" detail="Escolha os procedimentos e informe quantas sessões o plano oferece." count={`${procedureIds.length} selecionado${procedureIds.length === 1 ? '' : 's'}`} />
        <Group label="Procedimentos disponíveis" empty="Cadastre um procedimento antes de montar um plano." items={procedures.map((procedure) => ({ id: procedure.id, name: procedure.name, minSessions: procedure.baseSessions ?? 1 }))} selected={procedureIds} sessions={procedureSessions} onSessionsChange={(id, value) => setProcedureSessions((current) => ({ ...current, [id]: value }))} onToggle={(id, on) => setProcedureIds((list) => toggle(list, id, on))} />
      </section>
      <section className="plan-section">
        <SectionHeading icon={<FileText size={17} />} title="Contratos e anamnese" detail="Defina quais documentos acompanham a contratação." count={`${contractIds.length} contrato${contractIds.length === 1 ? '' : 's'}`} />
        <Group label="Contratos adicionais" hint="O contrato padrão e os contratos dos procedimentos e combos são incluídos automaticamente." empty="Nenhum contrato adicional cadastrado." items={contracts.filter((contract) => contract.kind !== 'standard').map((contract) => ({ id: contract.id, name: contract.title }))} selected={contractIds} onToggle={(id, on) => setContractIds((list) => toggle(list, id, on))} />
        <Label className="plan-anamnesis cursor-pointer"><Checkbox checked={requireNewAnamnesis} onCheckedChange={(value) => setRequireNewAnamnesis(value === true)} /><span><strong>Solicitar nova anamnese</strong><small>Mesmo que a última ainda esteja dentro do prazo de validade.</small></span></Label>
      </section>
    </FormPage>
  );
}

function SectionHeading({ icon, title, detail, count }: { icon: ReactNode; title: string; detail: string; count?: string }) {
  return <div className="plan-section-heading"><span className="plan-section-icon">{icon}</span><div><h3>{title}</h3><p>{detail}</p></div>{count && <span className="plan-count">{count}</span>}</div>;
}

function Group({ label, hint, empty, items, selected, sessions, onSessionsChange, onToggle }: { label: string; hint?: string; empty?: string; items: { id: string; name: string; minSessions?: number }[]; selected: string[]; sessions?: Record<string, string>; onSessionsChange?: (id: string, value: string) => void; onToggle: (id: string, on: boolean) => void }) {
  return (
    <div role="group" aria-label={label} className="plan-choice-group">
      <span className="plan-choice-label">{label}</span>
      {hint && <span className="plan-choice-hint">{hint}</span>}
      {items.length === 0 && empty && <p className="plan-choice-empty">{empty}</p>}
      <div className="plan-choice-list">
        {items.map((item) => (
          <div key={item.id} className={`plan-choice${selected.includes(item.id) ? ' is-selected' : ''}`}>
            <Label className="plan-choice-main cursor-pointer">
              <Checkbox checked={selected.includes(item.id)} onCheckedChange={(value) => { onToggle(item.id, value === true); if (value === true && onSessionsChange) onSessionsChange(item.id, String(item.minSessions ?? 1)); }} />
              {item.name}
            </Label>
            {selected.includes(item.id) && onSessionsChange && <Label className="plan-sessions">Sessões<Input aria-label={`Sessões de ${item.name}`} className="w-20" type="number" min={item.minSessions ?? 1} value={sessions?.[item.id] ?? String(item.minSessions ?? 1)} onChange={(event) => onSessionsChange(item.id, event.target.value)} /></Label>}
          </div>
        ))}
      </div>
    </div>
  );
}
