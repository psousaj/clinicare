import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Activity, CalendarDays, ChevronRight, Search, Sparkles, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { matchesPatient } from '@/components/PatientRow';
import { QueryError } from '@/components/QueryState';
import { dateTime, shortDate } from '@/lib/format';
import { appointmentsQuery, patientsQuery, followupsQuery, proceduresQuery, attendancesQuery, signaturePendingQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/')({ component: Overview });

function SignatureGroup({ title, description, items }: { title: string; description: string; items: Array<{ participantId: string; title: string; patient: { fullName: string } }> }) {
  if (!items.length) return null;
  return <section><h3 className="m-0 text-sm font-semibold">{title}</h3><p className="m-0 text-sm text-muted-foreground">{description}</p><ul className="m-0 mt-2 grid gap-2 pl-5">{items.map((item) => <li key={item.participantId}><strong>{item.title}</strong> · {item.patient.fullName}</li>)}</ul></section>;
}

function Overview() {
  const patients = useQuery(patientsQuery), procedures = useQuery(proceduresQuery), appointments = useQuery(appointmentsQuery), followups = useQuery(followupsQuery), attendances = useQuery(attendancesQuery), signatures = useQuery(signaturePendingQuery);
  const [query, setQuery] = useState('');
  const patientList = patients.data ?? [], appointmentList = appointments.data ?? [];
  // "Próximas" = apenas agendamentos acionáveis no futuro (planejado/remarcado
  // e ainda não encerrado). Confirmados já viraram atendimento, e vencidos
  // ficam para confirmação na Agenda — não podem ocupar o topo da Visão geral.
  const now = new Date();
  const upcomingSessions = appointmentList
    .filter((appointment) => (appointment.status === 'planned' || appointment.status === 'rescheduled') && new Date(appointment.endsAt) >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 4);
  // Sessões já vêm da mais recente para a mais antiga; cada paciente aparece uma vez, na sua última sessão.
  const recent = new Map<string, { patientId: string; procedureName: string; performedAt: string }>();
  for (const attendance of attendances.data ?? []) if (!recent.has(attendance.patientId)) recent.set(attendance.patientId, attendance);
  const recentPatients = [...recent.values()].map((attendance) => ({ attendance, patient: patientList.find((candidate) => candidate.id === attendance.patientId) })).filter((entry) => entry.patient && matchesPatient(entry.patient, query));
  const stats = [
    { heading: 'Pacientes cadastrados', icon: UsersRound, tone: 'violet', value: patientList.length, suffix: ' no total', foot: 'Base da clínica' },
    { heading: 'Procedimentos ativos', icon: Sparkles, tone: 'peach', value: (procedures.data ?? []).length, suffix: ' cadastrados', foot: 'Catálogo da clínica' },
    { heading: 'Agendamentos', icon: CalendarDays, tone: 'blue', value: appointmentList.length, suffix: ' marcados', foot: 'Calendário semanal' },
    { heading: 'Acompanhamentos', icon: Activity, tone: 'mint', value: (followups.data ?? []).length, suffix: ' iniciados', foot: 'Acompanhamento' },
  ];
  return (
    <>
      <QueryError query={patients} />
      {signatures.data && signatures.data.length > 0 && <section className="panel mb-4"><div className="panel-header"><div><div className="section-kicker">ASSINATURAS PENDENTES</div><h2>Documentos que precisam de atenção</h2></div><Link className="text-button" to="/documentos">Abrir documentos</Link></div><div className="grid gap-4 text-sm"><SignatureGroup title="Bloqueiam a liberação" items={signatures.data.filter((item) => item.blocking)} description="O paciente precisa confirmar estes contratos antes de o plano ficar ativo." /><SignatureGroup title="Pendências administrativas" items={signatures.data.filter((item) => !item.blocking)} description="A assinatura profissional acompanha a documentação, mas não bloqueia a execução." /></div></section>}
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
          {attendances.isSuccess && recentPatients.length === 0 && <p className="text-sm text-muted-foreground">{query ? 'Nenhum paciente encontrado.' : 'Nenhum atendimento realizado ainda. Os pacientes aparecem aqui depois do primeiro acompanhamento.'}</p>}
          {recentPatients.slice(0, 5).map(({ attendance, patient }) => (
            <Link key={patient!.id} to="/pacientes/$patientId" params={{ patientId: patient!.id }} className="patient-row">
              <span className="patient-initials">{patient!.fullName.slice(0, 2).toUpperCase()}</span>
              <span className="patient-info"><strong>{patient!.fullName}</strong><small>{attendance.procedureName} · {shortDate(attendance.performedAt)}</small></span>
              <ChevronRight size={16} />
            </Link>
          ))}
        </article>
        <article className="panel">
          <div className="panel-header"><div><div className="section-kicker">EXECUÇÃO</div><h2>Próximas sessões</h2></div><Link className="text-button" to="/agenda">Abrir agenda</Link></div>
          {upcomingSessions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessão futura agendada.</p>}
          {upcomingSessions.map((appointment) => (
            <div className="procedure-row" key={appointment.id}>
              <CalendarDays size={18} />
              <span className="procedure-info"><strong>{patientList.find((patient) => patient.id === appointment.patientId)?.fullName ?? 'Paciente'}</strong><small>{dateTime(appointment.startsAt)} · {appointment.items.map((item) => item.procedureName).join(', ')}</small></span>
            </div>
          ))}
        </article>
      </section>
    </>
  );
}
