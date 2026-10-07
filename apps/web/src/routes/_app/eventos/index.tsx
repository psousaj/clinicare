import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Pencil, PartyPopper, Power, Users } from 'lucide-react';
import { useState } from 'react';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { eventsQuery, useSaveEvent } from '@/lib/queries';

export const Route = createFileRoute('/_app/eventos/')({ component: Events });

// A data do evento é civil (AAAA-MM-DD): formata sem passar por fuso horário.
const civil = (value: string) => value.split('-').reverse().join('/');

function Events() {
  const events = useQuery(eventsQuery);
  const save = useSaveEvent();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = (events.data ?? []).find((event) => event.id === selectedEventId);
  return (
    <div className="space-y-6">
    <section className="panel" aria-label="Eventos cadastrados">
      <div className="panel-header"><h2>Eventos</h2><Button asChild><Link to="/eventos/novo">＋ Novo evento</Link></Button></div>
      <QueryError query={events} />
      {events.isSuccess && events.data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento cadastrado. Um evento é um dia da clínica com cardápio de procedimentos e combos e contratos; o valor só nasce da baixa do que foi realizado.</p>}
      {(events.data ?? []).map((event) => (
        <div className="procedure-row" key={event.id}>
          <PartyPopper size={18} />
          <span className="procedure-info">
            <strong>{event.name}</strong>
            <small>{civil(event.eventDate)} · {event.items.length} {event.items.length === 1 ? 'item no cardápio' : 'itens no cardápio'} · {event.enrolledPatients.length} {event.enrolledPatients.length === 1 ? 'paciente inscrito' : 'pacientes inscritos'}</small>
          </span>
          {event.active === false && <StatusBadge tone="neutral">Inativo</StatusBadge>}
          <Button variant="ghost" size="sm" asChild aria-label={`Editar ${event.name}`}><Link to="/eventos/novo" search={{ eventId: event.id }}><Pencil /></Link></Button>
          <Button variant="ghost" size="sm" disabled={save.isPending} onClick={() => save.mutate({ id: event.id, active: event.active === false })} aria-label={`${event.active === false ? 'Reativar' : 'Desativar'} ${event.name}`}><Power /></Button>
        </div>
      ))}
    </section>
      {events.isSuccess && events.data.length > 0 && <>
        <section className="panel" aria-labelledby="event-patients-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><h2 id="event-patients-title" className="text-base font-semibold">Pacientes por evento</h2><p className="text-sm text-muted-foreground">Escolha um evento para ver quem está inscrito.</p></div>
            {selectedEvent && <Button variant="ghost" size="sm" onClick={() => setSelectedEventId(null)}>Limpar seleção</Button>}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar pacientes por evento">
            {events.data.map((event) => <Button key={event.id} type="button" variant={selectedEventId === event.id ? 'default' : 'outline'} size="sm" aria-pressed={selectedEventId === event.id} onClick={() => setSelectedEventId(event.id)}>{event.name}<span className="rounded-full bg-background/70 px-1.5 py-0.5 text-xs">{event.enrolledPatients.length}</span></Button>)}
          </div>
        <div className="mt-5 border-t pt-5" aria-live="polite">
          {!selectedEvent ? <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center"><Users className="text-muted-foreground" size={24} /><p className="font-medium">Nenhum evento selecionado</p><p className="text-sm text-muted-foreground">Selecione um badge acima para listar os pacientes inscritos.</p></div> : selectedEvent.enrolledPatients.length === 0 ? <div className="flex min-h-32 flex-col items-center justify-center gap-2 text-center"><Users className="text-muted-foreground" size={24} /><p className="font-medium">Nenhum paciente inscrito</p><p className="text-sm text-muted-foreground">Este evento ainda não tem inscrições.</p></div> : <><div className="mb-4 flex items-baseline justify-between gap-3"><h3 className="text-base font-semibold">{selectedEvent.name}</h3><span className="text-sm text-muted-foreground">{selectedEvent.enrolledPatients.length} {selectedEvent.enrolledPatients.length === 1 ? 'paciente' : 'pacientes'}</span></div><div className="grid gap-2 sm:grid-cols-2">{selectedEvent.enrolledPatients.map((patient) => <Link key={patient.id} to="/pacientes/$patientId" params={{ patientId: patient.id }} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{patient.fullName.charAt(0).toLocaleUpperCase()}</span><span className="font-medium">{patient.fullName}</span></Link>)}</div></>}
        </div>
        </section>
      </>}
    </div>
  );
}
