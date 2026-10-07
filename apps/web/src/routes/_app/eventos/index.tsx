import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Pencil, PartyPopper, Power } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  const [patientFilter, setPatientFilter] = useState('');
  const normalizedFilter = patientFilter.trim().toLocaleLowerCase();
  const filteredEvents = useMemo(() => (events.data ?? []).map((event) => ({ ...event, visiblePatients: event.enrolledPatients.filter((patient) => patient.fullName.toLocaleLowerCase().includes(normalizedFilter)) })).filter((event) => !normalizedFilter || event.visiblePatients.length > 0), [events.data, normalizedFilter]);
  return (
    <section className="panel">
      <div className="panel-header"><h2>Eventos</h2><Button asChild><Link to="/eventos/novo">＋ Novo evento</Link></Button></div>
      <label className="mb-4 block text-sm font-medium" htmlFor="event-patient-filter">Filtrar pacientes inscritos nos eventos<input id="event-patient-filter" className="input mt-1 w-full" value={patientFilter} onChange={(event) => setPatientFilter(event.target.value)} placeholder="Buscar paciente" /></label>
      <QueryError query={events} />
      {events.isSuccess && events.data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento cadastrado. Um evento é um dia da clínica com cardápio de procedimentos e combos e contratos; o valor só nasce da baixa do que foi realizado.</p>}
      {filteredEvents.map((event) => (
        <div className="procedure-row" key={event.id}>
          <PartyPopper size={18} />
          <span className="procedure-info">
            <strong>{event.name}</strong>
            <small>{civil(event.eventDate)} · {event.items.length} {event.items.length === 1 ? 'item no cardápio' : 'itens no cardápio'} · {event.enrolledPatients.length} {event.enrolledPatients.length === 1 ? 'paciente inscrito' : 'pacientes inscritos'}</small>
            {event.visiblePatients.length > 0 && <small className="block">{event.visiblePatients.map((patient) => patient.fullName).join(' · ')}</small>}
          </span>
          {event.active === false && <StatusBadge tone="neutral">Inativo</StatusBadge>}
          <Button variant="ghost" size="sm" asChild aria-label={`Editar ${event.name}`}><Link to="/eventos/novo" search={{ eventId: event.id }}><Pencil /></Link></Button>
          <Button variant="ghost" size="sm" disabled={save.isPending} onClick={() => save.mutate({ id: event.id, active: event.active === false })} aria-label={`${event.active === false ? 'Reativar' : 'Desativar'} ${event.name}`}><Power /></Button>
        </div>
      ))}
    </section>
  );
}
