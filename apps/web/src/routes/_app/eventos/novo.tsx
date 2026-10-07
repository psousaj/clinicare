import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { CalendarDays, FileText, PartyPopper } from 'lucide-react';
import { Field } from '@/components/Field';
import { FormPage } from '@/components/FormPage';
import { AnamnesisPicker, InheritedAnamneses } from '@/components/AnamnesisPicker';
import { toggleId } from '@/lib/utils';
import { PlanOfferPicker } from '@/components/PlanOfferPicker';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { minSessionsOf, sessionsFor } from '@/lib/planOffers';
import { anamnesesQuery, combosQuery, contractsQuery, eventsQuery, proceduresQuery, useSaveEvent } from '@/lib/queries';
import type { Anamnesis, Combo, EventOffer, Procedure } from '@/lib/schemas';

export const Route = createFileRoute('/_app/eventos/novo')({ validateSearch: z.object({ eventId: z.string().optional() }), component: NewEvent });

// Dia da clínica com cardápio: nome, data civil, procedimentos/combos (combo entra fechado) e contratos exigidos.
// O valor não aparece aqui de propósito — só nasce da baixa do que for realizado.
function NewEvent() {
  const { eventId } = Route.useSearch();
  const save = useSaveEvent();
  const procedures = (useQuery(proceduresQuery).data ?? []).filter((procedure) => procedure.active !== false);
  const combos = (useQuery(combosQuery).data ?? []).filter((combo) => combo.active !== false);
  const contracts = (useQuery(contractsQuery).data ?? []).filter((contract) => contract.active !== false);
  const existing = useQuery(eventsQuery).data?.find((event) => event.id === eventId);
  const forms = useQuery(anamnesesQuery).data ?? [];
  const [procedureIds, setProcedureIds] = useState<string[]>([]);
  const [comboIds, setComboIds] = useState<string[]>([]);
  const [pickedAnamnesisIds, setPickedAnamnesisIds] = useState<string[]>([]);
  const [procedureSessions, setProcedureSessions] = useState<Record<string, string>>({});
  const [contractIds, setContractIds] = useState<string[]>([]);

  useEffect(() => {
    if (!existing) return;
    setProcedureIds(existing.items.filter((item) => item.kind === 'procedure').map((item) => item.procedureId));
    setComboIds(existing.items.filter((item) => item.kind === 'combo').map((item) => item.comboId));
    setProcedureSessions(Object.fromEntries(existing.items.filter((item) => item.kind === 'procedure').map((item) => [item.procedureId, String(item.sessions)])));
    setPickedAnamnesisIds([...(existing.anamnesisIds ?? [])]);
    setContractIds([...existing.contractIds]);
  }, [existing]);

  return (
    <FormPage
      backTo="/eventos"
      backLabel="Eventos"
      title={eventId ? `Editar · ${existing?.name ?? 'Evento'}` : 'Novo evento'}
      submitLabel="Salvar evento"
      onSubmit={async (form) => {
        const name = String(form.get('name') ?? '').trim();
        const eventDate = String(form.get('eventDate') ?? '');
        if (name.length < 2) throw new Error('Dê um nome ao evento.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) throw new Error('Escolha a data do evento.');
        const chosen = procedureIds.map((id) => procedures.find((procedure) => procedure.id === id)!).filter(Boolean);
        if (!chosen.length && !comboIds.length) throw new Error('Escolha ao menos um item para o cardápio.');
        if (!contractIds.length) throw new Error('Escolha ao menos um contrato.');
        const items = [
          ...chosen.map((procedure) => ({ kind: 'procedure' as const, procedureId: procedure.id, sessions: sessionsFor(procedure, procedureSessions) })),
          ...comboIds.map((comboId) => ({ kind: 'combo' as const, comboId })),
        ];
        await save.mutateAsync({ id: eventId, name, eventDate, items, contractIds, anamnesisIds: pickedAnamnesisIds });
      }}
    >
      <div className="plan-intro"><span className="plan-intro-mark"><PartyPopper size={19} /></span><div><p>Monte o dia da clínica</p><span>Cada paciente escolhe do cardápio; o valor só nasce da baixa do que foi realizado. Combo entra fechado.</span></div></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do evento" name="name" required autoFocus placeholder="Ex.: Sábado do botox" defaultValue={existing?.name ?? ''} />
        <Field label="Data do evento" name="eventDate" type="date" required defaultValue={existing?.eventDate ?? ''} />
      </div>
      <section className="plan-section">
        <div className="plan-section-heading"><span className="plan-section-icon"><CalendarDays size={17} /></span><div><h3>Cardápio do dia</h3><p>Busque e marque procedimentos e combos. Nos combos, as sessões seguem a configuração do próprio combo.</p></div><span className="plan-count">{procedureIds.length + comboIds.length} selecionado{procedureIds.length + comboIds.length === 1 ? '' : 's'}</span></div>
        <PlanOfferPicker
          procedures={procedures}
          combos={combos}
          procedureIds={procedureIds}
          comboIds={comboIds}
          sessions={procedureSessions}
          onToggleProcedure={(id, on) => {
            setProcedureIds((list) => toggleId(list, id, on));
            if (on) setProcedureSessions((current) => ({ ...current, [id]: current[id] ?? String(minSessionsOf(procedures.find((procedure) => procedure.id === id)!)) }));
          }}
          onToggleCombo={(id, on) => setComboIds((list) => toggleId(list, id, on))}
          onSessionsChange={(id, value) => setProcedureSessions((current) => ({ ...current, [id]: value }))}
        />
      </section>
      <section className="plan-section">
        <div className="plan-section-heading"><span className="plan-section-icon"><FileText size={17} /></span><div><h3>Anamneses exigidas</h3><p>Vinculadas neste evento, além das exigidas pelos procedimentos do cardápio.</p></div><span className="plan-count">{pickedAnamnesisIds.length} vinculada{pickedAnamnesisIds.length === 1 ? '' : 's'}</span></div>
        <AnamnesisPicker forms={forms} pickedIds={pickedAnamnesisIds} onToggle={(id, on) => setPickedAnamnesisIds((list) => toggleId(list, id, on))} />
        <InheritedAnamneses procedures={procedures} combos={combos} forms={forms} procedureIds={procedureIds} comboIds={comboIds} pickedIds={pickedAnamnesisIds} />
      </section>
      <section className="plan-section">
        <div className="plan-section-heading"><span className="plan-section-icon"><FileText size={17} /></span><div><h3>Contratos exigidos</h3><p>A escolha de cada paciente vai para estes contratos na inscrição.</p></div><span className="plan-count">{contractIds.length} contrato{contractIds.length === 1 ? '' : 's'}</span></div>
        <div role="group" aria-label="Contratos do evento" className="plan-choice-group">
          {contracts.length === 0 && <p className="plan-choice-empty">Nenhum contrato ativo cadastrado.</p>}
          <div className="plan-choice-list">
            {contracts.map((contract) => (
              <div key={contract.id} className={contractIds.includes(contract.id) ? 'plan-choice is-selected' : 'plan-choice'}>
                <Label className="plan-choice-main cursor-pointer">
                  <Checkbox checked={contractIds.includes(contract.id)} onCheckedChange={(value) => setContractIds((list) => toggleId(list, contract.id, value === true))} />
                  {contract.title}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FormPage>
  );
}
