import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { CalendarDays, Check, ChevronRight, Pencil, Plus, Power, Users, X } from 'lucide-react';
import { useState } from 'react';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { eventsQuery, useSaveEvent } from '@/lib/queries';
import './events.css';

export const Route = createFileRoute('/_app/eventos/')({ component: Events });

// Datas civis não passam por conversão de fuso horário.
const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const civil = (value: string) => value.split('-').reverse().join('/');
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).filter((_, index, parts) => index === 0 || index === parts.length - 1).map((part) => part.charAt(0)).join('').toLocaleUpperCase('pt-BR');

function Events() {
  const events = useQuery(eventsQuery);
  const save = useSaveEvent();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = events.data?.find((event) => event.id === selectedEventId);

  return (
    <div className="events-page">
      <section className="events-panel" aria-label="Eventos cadastrados">
        <header className="events-header">
          <div>
            <h2>Eventos cadastrados</h2>
            <p>Os dias especiais da sua clínica.</p>
          </div>
          <Button asChild className="events-create"><Link to="/eventos/novo"><Plus aria-hidden="true" />Novo evento</Link></Button>
        </header>
        <QueryError query={events} />
        {events.isPending && <p className="events-message" role="status">Carregando eventos…</p>}
        {events.isSuccess && events.data.length === 0 && <div className="events-empty">
          <CalendarDays aria-hidden="true" />
          <h3>Seu primeiro evento começa aqui</h3>
          <p>Crie um evento com data e cardápio para inscrever seus pacientes.</p>
        </div>}
        <div className="events-catalog">
          {events.data?.map((event) => (
            <article className="event-entry" key={event.id}>
              <time className="event-date" dateTime={event.eventDate} aria-label={civil(event.eventDate)}>
                <span>{months[Number(event.eventDate.slice(5, 7)) - 1]}</span>
                <strong>{event.eventDate.slice(8, 10)}</strong>
                <small>{event.eventDate.slice(0, 4)}</small>
              </time>
              <div className="event-details">
                <div className="event-name"><h3>{event.name}</h3>{event.active === false && <StatusBadge tone="neutral">Inativo</StatusBadge>}</div>
                <div className="event-meta">
                  <span>{event.items.length} {event.items.length === 1 ? 'item no cardápio' : 'itens no cardápio'}</span>
                  <span><Users size={14} aria-hidden="true" />{event.enrolledPatients.length} {event.enrolledPatients.length === 1 ? 'inscrito' : 'inscritos'}</span>
                </div>
              </div>
              <div className="event-actions">
                <Button variant="ghost" size="icon" asChild aria-label={`Editar ${event.name}`} title={`Editar ${event.name}`}><Link to="/eventos/novo" search={{ eventId: event.id }}><Pencil /></Link></Button>
                <Button variant="ghost" size="icon" disabled={save.isPending} onClick={() => save.mutate({ id: event.id, active: event.active === false })} aria-label={`${event.active === false ? 'Reativar' : 'Desativar'} ${event.name}`} title={`${event.active === false ? 'Reativar' : 'Desativar'} ${event.name}`}><Power /></Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {events.isSuccess && events.data.length > 0 && (
        <section className="events-panel event-patients" aria-labelledby="event-patients-title">
          <header className="events-header">
            <div>
              <h2 id="event-patients-title">Pacientes por evento</h2>
              <p>Selecione um evento para consultar os inscritos.</p>
            </div>
            {selectedEvent && <Button className="events-clear" variant="ghost" onClick={() => setSelectedEventId(null)}><X aria-hidden="true" />Limpar seleção</Button>}
          </header>
          <div className="event-filters" role="group" aria-label="Filtrar pacientes por evento">
            {events.data.map((event) => (
              <button className="event-chip" key={event.id} type="button" aria-pressed={selectedEventId === event.id} onClick={() => setSelectedEventId(event.id)}>
                {selectedEventId === event.id && <Check size={15} aria-hidden="true" />}
                <span className="event-chip-name">{event.name}</span>
                <span className="event-chip-count">{event.enrolledPatients.length}</span>
              </button>
            ))}
          </div>
          <div className="event-patient-results" aria-live="polite">
            {!selectedEvent ? (
              <div className="events-empty">
                <span className="events-empty-icon"><Users size={24} aria-hidden="true" /></span>
                <h3>Nenhum evento selecionado</h3>
                <p>Escolha um dos eventos acima.<br />Os pacientes inscritos aparecem aqui.</p>
              </div>
            ) : (
              <>
                <div className="event-results-heading">
                  <div><h3>{selectedEvent.name}</h3><time dateTime={selectedEvent.eventDate}>{civil(selectedEvent.eventDate)}</time></div>
                  <span>{selectedEvent.enrolledPatients.length} {selectedEvent.enrolledPatients.length === 1 ? 'paciente' : 'pacientes'}</span>
                </div>
                {selectedEvent.enrolledPatients.length === 0 ? (
                  <div className="events-empty"><Users aria-hidden="true" /><h3>Nenhum paciente inscrito</h3><p>As inscrições deste evento aparecerão aqui.</p></div>
                ) : (
                  <ul className="event-patient-list">
                    {selectedEvent.enrolledPatients.map((patient) => (
                      <li key={patient.id}>
                        <Link className="event-patient-link" to="/pacientes/$patientId" params={{ patientId: patient.id }}>
                          <span className="event-patient-avatar" aria-hidden="true">{initials(patient.fullName)}</span>
                          <span className="event-patient-name">{patient.fullName}</span>
                          <span className="event-patient-open">Ver ficha</span><ChevronRight size={17} aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
