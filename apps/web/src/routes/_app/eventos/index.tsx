import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Pencil, PartyPopper, Power } from 'lucide-react';
import { useState } from 'react';
import { Field, FormDialog } from '@/components/FormDialog';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { currency } from '@/lib/format';
import { combosQuery, contractsQuery, eventsQuery, proceduresQuery, useSaveEvent } from '@/lib/queries';
import type { EventOffer } from '@/lib/schemas';

export const Route = createFileRoute('/_app/eventos/')({ component: Events });

// A data do evento é civil (AAAA-MM-DD): formata sem passar por fuso horário.
const civil = (value: string) => value.split('-').reverse().join('/');

function Events() {
  const events = useQuery(eventsQuery);
  const save = useSaveEvent();
  const [editing, setEditing] = useState<EventOffer | 'new' | null>(null);
  return (
    <section className="panel">
      <div className="panel-header"><h2>Eventos</h2><Button onClick={() => setEditing('new')}>＋ Novo evento</Button></div>
      <QueryError query={events} />
      {events.isSuccess && events.data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento cadastrado. Um evento é um dia da clínica com cardápio de procedimentos e combos e contratos; o valor só nasce da baixa do que foi realizado.</p>}
      {(events.data ?? []).map((event) => (
        <div className="procedure-row" key={event.id}>
          <PartyPopper size={18} />
          <span className="procedure-info">
            <strong>{event.name}</strong>
            <small>{civil(event.eventDate)} · {event.items.length} {event.items.length === 1 ? 'item no cardápio' : 'itens no cardápio'} · {event.contractIds.length} {event.contractIds.length === 1 ? 'contrato' : 'contratos'}</small>
          </span>
          {event.active === false && <StatusBadge tone="neutral">Inativo</StatusBadge>}
          <Button variant="ghost" size="sm" onClick={() => setEditing(event)} aria-label={`Editar ${event.name}`}><Pencil /></Button>
          <Button variant="ghost" size="sm" disabled={save.isPending} onClick={() => save.mutate({ id: event.id, active: event.active === false })} aria-label={`${event.active === false ? 'Reativar' : 'Desativar'} ${event.name}`}><Power /></Button>
        </div>
      ))}
      <EventDialog key={editing === 'new' ? 'new' : editing?.id ?? 'closed'} event={editing === 'new' ? null : editing} open={editing !== null} onClose={() => setEditing(null)} />
    </section>
  );
}

function EventDialog({ event, open, onClose }: { event: EventOffer | null; open: boolean; onClose: () => void }) {
  const procedures = (useQuery(proceduresQuery).data ?? []).filter((procedure) => procedure.active !== false);
  const combos = (useQuery(combosQuery).data ?? []).filter((combo) => combo.active !== false);
  const contracts = (useQuery(contractsQuery).data ?? []).filter((contract) => contract.active !== false);
  const save = useSaveEvent();
  const [picked, setPicked] = useState<Set<string>>(() => new Set((event?.items ?? []).map((item) => item.kind === 'procedure' ? `procedure:${item.procedureId}` : `combo:${item.comboId}`)));
  const [pickedContracts, setPickedContracts] = useState<Set<string>>(() => new Set(event?.contractIds ?? []));
  const toggle = (set: Set<string>, setter: (next: Set<string>) => void, key: string) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); setter(next); };
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={event ? 'Editar evento' : 'Novo evento'}
      description="Dia da clínica com cardápio. Cada paciente escolhe do cardápio; o valor só nasce da baixa do que foi realizado. Combo entra fechado."
      submitLabel="Salvar evento"
      wide
      onSubmit={async (form) => {
        if (!picked.size) throw new Error('Escolha ao menos um item para o cardápio.');
        if (!pickedContracts.size) throw new Error('Escolha ao menos um contrato.');
        const items = [...picked].map((key) => {
          const [kind, id] = key.split(':');
          if (kind === 'combo') return { kind: 'combo', comboId: id };
          const base = procedures.find((procedure) => procedure.id === id)?.baseSessions ?? 1;
          const previous = event?.items.find((item) => item.kind === 'procedure' && item.procedureId === id);
          return { kind: 'procedure', procedureId: id, sessions: previous && previous.kind === 'procedure' ? previous.sessions : base };
        });
        await save.mutateAsync({ id: event?.id, name: String(form.get('name') ?? '').trim(), eventDate: String(form.get('eventDate') ?? ''), items, contractIds: [...pickedContracts] });
      }}
    >
      <Field label="Nome do evento" name="name" defaultValue={event?.name ?? ''} required minLength={2} />
      <Field label="Data do evento" name="eventDate" type="date" defaultValue={event?.eventDate ?? ''} required />
      <fieldset className="grid gap-1 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Cardápio · procedimentos</legend>
        {procedures.map((procedure) => (
          <Label key={procedure.id} className="flex items-center gap-2 font-normal"><Checkbox checked={picked.has(`procedure:${procedure.id}`)} onCheckedChange={() => toggle(picked, setPicked, `procedure:${procedure.id}`)} />{procedure.name} · {currency(procedure.priceCents)}</Label>
        ))}
        {procedures.length === 0 && <small className="text-muted-foreground">Nenhum procedimento ativo.</small>}
      </fieldset>
      <fieldset className="grid gap-1 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Cardápio · combos (pacote fechado)</legend>
        {combos.map((combo) => (
          <Label key={combo.id} className="flex items-center gap-2 font-normal"><Checkbox checked={picked.has(`combo:${combo.id}`)} onCheckedChange={() => toggle(picked, setPicked, `combo:${combo.id}`)} />{combo.name} · {currency(combo.promotionalPriceCents ?? combo.priceCents)}</Label>
        ))}
        {combos.length === 0 && <small className="text-muted-foreground">Nenhum combo ativo.</small>}
      </fieldset>
      <fieldset className="grid gap-1 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Contratos exigidos</legend>
        {contracts.map((contract) => (
          <Label key={contract.id} className="flex items-center gap-2 font-normal"><Checkbox checked={pickedContracts.has(contract.id)} onCheckedChange={() => toggle(pickedContracts, setPickedContracts, contract.id)} />{contract.title}</Label>
        ))}
        {contracts.length === 0 && <small className="text-muted-foreground">Nenhum contrato ativo.</small>}
      </fieldset>
    </FormDialog>
  );
}
