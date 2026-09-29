import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Activity, CalendarDays, Search, Sparkles, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { PatientRow, matchesPatient } from '@/components/PatientRow';
import { QueryError } from '@/components/QueryState';
import { dateTime } from '@/lib/format';
import { appointmentsQuery, patientsQuery, plansQuery, proceduresQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/')({ component: Overview });

function Overview() {
  const patients = useQuery(patientsQuery), procedures = useQuery(proceduresQuery), appointments = useQuery(appointmentsQuery), plans = useQuery(plansQuery);
  const [query, setQuery] = useState('');
  const patientList = patients.data ?? [], appointmentList = appointments.data ?? [];
  const stats = [
    { heading: 'Pacientes cadastrados', icon: UsersRound, tone: 'violet', value: patientList.length, suffix: ' no total', foot: 'Base da clínica' },
    { heading: 'Procedimentos ativos', icon: Sparkles, tone: 'peach', value: (procedures.data ?? []).length, suffix: ' cadastrados', foot: 'Catálogo da clínica' },
    { heading: 'Agendamentos', icon: CalendarDays, tone: 'blue', value: appointmentList.length, suffix: ' marcados', foot: 'Calendário semanal' },
    { heading: 'Planos ativos', icon: Activity, tone: 'mint', value: (plans.data ?? []).length, suffix: ' contratados', foot: 'Acompanhamento' },
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
          <div className="panel-header"><div><div className="section-kicker">RELACIONAMENTO</div><h2>Pacientes recentes</h2></div></div>
          <label className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paciente por nome ou telefone" /></label>
          {patientList.filter((patient) => matchesPatient(patient, query)).slice(0, 5).map((patient) => <PatientRow key={patient.id} patient={patient} />)}
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
