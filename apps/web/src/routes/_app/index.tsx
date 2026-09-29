import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Activity, CalendarDays, ChevronRight, Search, Sparkles, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { matchesPatient } from '@/components/PatientRow';
import { QueryError } from '@/components/QueryState';
import { dateTime, shortDate } from '@/lib/format';
import { appointmentsQuery, patientsQuery, followupsQuery, proceduresQuery, sessionsQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/')({ component: Overview });

function Overview() {
  const patients = useQuery(patientsQuery), procedures = useQuery(proceduresQuery), appointments = useQuery(appointmentsQuery), followups = useQuery(followupsQuery), sessions = useQuery(sessionsQuery);
  const [query, setQuery] = useState('');
  const patientList = patients.data ?? [], appointmentList = appointments.data ?? [];
  // Sessões já vêm da mais recente para a mais antiga; cada paciente aparece uma vez, na sua última sessão.
  const recent = new Map<string, { patientId: string; procedureName: string; performedAt: string }>();
  for (const session of sessions.data ?? []) if (!recent.has(session.patientId)) recent.set(session.patientId, session);
  const recentPatients = [...recent.values()].map((session) => ({ session, patient: patientList.find((candidate) => candidate.id === session.patientId) })).filter((entry) => entry.patient && matchesPatient(entry.patient, query));
  const stats = [
    { heading: 'Pacientes cadastrados', icon: UsersRound, tone: 'violet', value: patientList.length, suffix: ' no total', foot: 'Base da clínica' },
    { heading: 'Procedimentos ativos', icon: Sparkles, tone: 'peach', value: (procedures.data ?? []).length, suffix: ' cadastrados', foot: 'Catálogo da clínica' },
    { heading: 'Agendamentos', icon: CalendarDays, tone: 'blue', value: appointmentList.length, suffix: ' marcados', foot: 'Calendário semanal' },
    { heading: 'Acompanhamentos', icon: Activity, tone: 'mint', value: (followups.data ?? []).length, suffix: ' iniciados', foot: 'Acompanhamento' },
  ];
  return (
    <>
      <QueryError query={patients} />
      <section className="stats-grid">
        {stats.map(({ heading, icon: Icon, tone, value, suffix, foot }) => (
          <article className="stat-card" key={heading}>
            <div className="stat-heading">{heading} <span className={`stat-icon ${tone}`}><Icon size={17} /></span></div>
            <div className="stat-value">{value}<span className="stat-suffix">{suffix}</span></div>
            <div className="stat-foot">{foot}</div>
          </article>
        ))}
      </section>
      <section className="data-grid">
        <article className="panel">
          <div className="panel-header"><div><div className="section-kicker">RELACIONAMENTO</div><h2>Pacientes atendidos recentemente</h2></div></div>
          <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paciente por nome ou telefone" /></label>
          {sessions.isSuccess && recentPatients.length === 0 && <p className="text-sm text-muted-foreground">{query ? 'Nenhum paciente encontrado.' : 'Nenhum atendimento realizado ainda. Os pacientes aparecem aqui depois do primeiro acompanhamento.'}</p>}
          {recentPatients.slice(0, 5).map(({ session, patient }) => (
            <Link key={patient!.id} to="/pacientes/$patientId" params={{ patientId: patient!.id }} className="patient-row">
              <span className="patient-initials">{patient!.fullName.slice(0, 2).toUpperCase()}</span>
              <span className="patient-info"><strong>{patient!.fullName}</strong><small>{session.procedureName} · {shortDate(session.performedAt)}</small></span>
              <ChevronRight size={16} />
            </Link>
          ))}
        </article>
        <article className="panel">
          <div className="panel-header"><div><div className="section-kicker">EXECUÇÃO</div><h2>Próximas sessões</h2></div><Link className="text-button" to="/agenda">Abrir agenda</Link></div>
          {appointmentList.slice(0, 4).map((appointment) => (
            <div className="procedure-row" key={appointment.id}>
              <CalendarDays size={18} />
              <span className="procedure-info"><strong>{patientList.find((patient) => patient.id === appointment.patientId)?.fullName ?? 'Paciente'}</strong><small>{dateTime(appointment.startsAt)}</small></span>
            </div>
          ))}
        </article>
      </section>
    </>
  );
}
