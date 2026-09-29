import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, CalendarClock, CalendarDays, Clock, HandCoins, Hourglass, Repeat, Sparkles, UserX, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { QueryError } from '@/components/QueryState';
import { currency, duration, monthLabel, shortDate } from '@/lib/format';
import { patientsQuery, relationshipQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/pacientes/$patientId/relacionamento')({ component: Relationship });

const GREEN = '#26785f', AMBER = '#e0a94a', BLUE = '#5b8def';

function Card({ heading, icon: Icon, tone, value, foot }: { heading: string; icon: typeof Clock; tone: string; value: string; foot?: string }) {
  return (
    <article className="stat-card">
      <div className="stat-heading">{heading} <span className={`stat-icon ${tone}`}><Icon size={17} /></span></div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </article>
  );
}

function Chart({ title, note, children, empty }: { title: string; note?: string; children: React.ReactNode; empty?: string }) {
  return (
    <section className="panel">
      <div className="panel-header"><div><div className="section-kicker">GRÁFICO</div><h2>{title}</h2></div></div>
      {empty ? <p className="text-sm text-muted-foreground">{empty}</p> : <div className="h-64 w-full">{children}</div>}
      {note && !empty && <p className="section-note mt-2 mb-0">{note}</p>}
    </section>
  );
}

function Relationship() {
  const { patientId } = Route.useParams();
  const report = useQuery(relationshipQuery(patientId)), patients = useQuery(patientsQuery);
  const patient = patients.data?.find((candidate) => candidate.id === patientId);
  const data = report.data, totals = data?.totals;
  const monthly = (data?.monthly ?? []).map((row) => ({ ...row, label: monthLabel(row.month), duration: row.minutes ? duration(row.minutes) : '—' }));
  const followups = (data?.followups ?? []).map((row) => ({ name: row.offerName, Pago: row.paidCents / 100, Pendente: row.pendingCents / 100 }));
  const procedures = (data?.procedures ?? []).map((row) => ({ name: row.name, Minutos: row.minutes, attendances: row.attendances }));
  const money = (value: unknown) => currency(Math.round(Number(value) * 100));

  return (
    <div className="grid gap-4">
      <section className="panel">
        <div className="panel-header">
          <div>
            <Link to="/pacientes/$patientId" params={{ patientId }} className="text-button mb-2"><ArrowLeft size={14} /> {patient?.fullName ?? 'Paciente'}</Link>
            <h2>Relacionamento</h2>
            <p className="section-note m-0">Tempo de atendimento, atendimentos e valores de {patient?.fullName ?? 'paciente'} em um só lugar.</p>
          </div>
        </div>
        <QueryError query={report} />
        {report.isPending && <p className="section-note">Carregando…</p>}
        {totals?.followups === 0 && <p className="section-note" role="status">Este paciente ainda não tem acompanhamentos. Inicie um acompanhamento pela ficha para acompanhar o relacionamento.</p>}
      </section>
      {data && totals && totals.followups > 0 && (
        <>
          <section className="stats-grid">
            <Card heading="Atendimentos realizados" icon={Sparkles} tone="violet" value={`${totals.attendancesPerformed} de ${totals.attendancesContracted}`} foot="Realizadas × contratadas" />
            <Card heading="Tempo de atendimento" icon={Clock} tone="peach" value={duration(totals.minutesTotal)} foot={totals.attendancesWithoutDuration ? `${totals.attendancesWithoutDuration} atendimento(s) sem duração informada` : 'Soma da duração das sessões'} />
            <Card heading="Valores pagos" icon={Wallet} tone="mint" value={currency(totals.paidCents)} foot={`de ${currency(totals.contractedCents)} contratados`} />
            <Card heading="Valores pendentes" icon={HandCoins} tone="blue" value={currency(totals.pendingCents)} foot={`${currency(totals.dueForPerformedCents)} já realizados e não pagos`} />
          </section>
          <section className="stats-grid">
            <Card heading="Último atendimento" icon={CalendarDays} tone="violet" value={data.lastAttendanceAt ? shortDate(data.lastAttendanceAt) : '—'} foot={data.firstAttendanceAt ? `Primeira em ${shortDate(data.firstAttendanceAt)}` : 'Nenhum atendimento ainda'} />
            <Card heading="Próximo agendamento" icon={CalendarClock} tone="peach" value={data.nextAppointmentAt ? shortDate(data.nextAppointmentAt) : '—'} foot={data.nextAppointmentAt ? 'Agenda em aberto' : 'Nada agendado'} />
            <Card heading="Frequência" icon={Repeat} tone="mint" value={data.averageIntervalDays === null ? '—' : `${String(data.averageIntervalDays).replace('.', ',')} dias`} foot="Intervalo médio entre atendimentos" />
            <Card heading="Faltas" icon={UserX} tone="blue" value={String(totals.noShows)} foot="Agendamentos com falta" />
          </section>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <Chart title="Atendimentos por mês" empty={monthly.length === 0 ? 'Nenhum atendimento registrado ainda.' : undefined} note="Passe o mouse para ver o tempo de acompanhamento do mês.">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={28} />
                  <Tooltip formatter={(value, _name, item) => [`${value} (${(item.payload as { duration: string }).duration})`, 'Atendimentos']} />
                  <Bar dataKey="attendances" name="Atendimentos" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </Chart>
            <Chart title="Pago × pendente por acompanhamento" empty={followups.length === 0 ? 'Sem acompanhamentos.' : undefined}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={followups} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(value) => `R$ ${value}`} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={110} />
                  <Tooltip formatter={money} />
                  <Legend />
                  <Bar dataKey="Pago" stackId="valor" fill={GREEN} maxBarSize={36} />
                  <Bar dataKey="Pendente" stackId="valor" fill={AMBER} radius={[0, 4, 4, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </Chart>
            <Chart title="Tempo por procedimento" empty={procedures.length === 0 ? 'Nenhum atendimento registrado ainda.' : totals.minutesTotal === 0 ? 'Informe a duração ao registrar os atendimentos para ver o tempo por procedimento.' : undefined}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={procedures} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(value) => duration(Number(value))} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={110} />
                  <Tooltip formatter={(value, _name, item) => [`${duration(Number(value))} em ${(item.payload as { attendances: number }).attendances} atendimento(s)`, 'Tempo']} />
                  <Bar dataKey="Minutos" name="Tempo" fill={BLUE} radius={[0, 4, 4, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </Chart>
            <section className="panel">
              <div className="panel-header"><div><div className="section-kicker">FINANCEIRO</div><h2>Saldo por acompanhamento</h2></div></div>
              {data.followups.map((row) => (
                <div className="procedure-row" key={row.id}>
                  <Hourglass size={18} />
                  <span className="procedure-info"><strong>{row.offerName}</strong><small>{row.sessionsPerformed}/{row.sessionsTotal} sessões · pago {currency(row.paidCents)} de {currency(row.priceCents)}</small></span>
                  <strong className={row.pendingCents ? 'text-amber-700' : 'text-primary'}>{row.pendingCents ? `Pendente ${currency(row.pendingCents)}` : 'Quitado'}</strong>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
