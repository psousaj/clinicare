import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Camera, CalendarPlus, ChartNoAxesCombined, ClipboardPlus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { FollowupCard } from '@/components/FollowupCard';
import { AppointmentDialog, NewFollowupDialog, StandaloneAttendanceDialog } from '@/components/dialogs';
import { PatientTimeline } from '@/components/PatientTimeline';
import { PendingRequirements } from '@/components/PendingRequirements';
import { QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { dateTime } from '@/lib/format';
import { followupsQuery, combosQuery, patientHistoryQuery, patientsQuery, plansQuery, proceduresQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/pacientes/$patientId/')({ component: PatientDetail });

function PatientDetail() {
  const { patientId } = Route.useParams();
  const history = useQuery(patientHistoryQuery(patientId)), followups = useQuery(followupsQuery);
  const patients = useQuery(patientsQuery), procedures = useQuery(proceduresQuery), combos = useQuery(combosQuery), plans = useQuery(plansQuery);
  const [dialog, setDialog] = useState<'followup' | 'standalone' | 'appointment' | null>(null);
  const allFollowups = (followups.data ?? []).filter((followup) => followup.patientId === patientId);
  const patientFollowups = allFollowups.filter((followup) => followup.offerType !== 'procedure');
  const standaloneCharges = allFollowups.filter((followup) => followup.offerType === 'procedure');

  const patient = history.data?.patient;
  const upcoming = (history.data?.pending ?? []).filter((entry) => entry.type === 'appointment');
  const attendances = (history.data?.events ?? []).filter((entry) => entry.type === 'attendance' && entry.details?.id);
  return (
    <div className="grid gap-4">
      <section className="panel grid gap-3">
        <div className="panel-header">
          <div>
            <Link to="/pacientes" className="text-button mb-2"><ArrowLeft size={14} /> Pacientes</Link>
            <h2>{patient?.fullName ?? 'Paciente'}</h2>
            <p className="section-note m-0">{[patient?.phone, patient?.email].filter(Boolean).join(' · ') || (history.isSuccess ? 'Sem contato' : '')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild><Link to="/pacientes/$patientId/relacionamento" params={{ patientId }}><ChartNoAxesCombined /> Relacionamento</Link></Button>
            <Button variant="outline" onClick={() => setDialog('standalone')}><Sparkles /> Atendimento avulso</Button>
            <Button variant="outline" onClick={() => setDialog('followup')}><ClipboardPlus /> Novo acompanhamento</Button>
            <Button onClick={() => setDialog('appointment')}><CalendarPlus /> Novo agendamento</Button>
          </div>
        </div>
        <QueryError query={history} />
      </section>
      {history.data && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="grid gap-4">
            <PendingRequirements followups={allFollowups} patientId={patientId} />
            <section className="panel">
              <div className="panel-header"><h2>Acompanhamentos</h2></div>
              {patientFollowups.length === 0 && <p className="text-sm text-muted-foreground">Inicie um acompanhamento para escolher os procedimentos e registrar sessões.</p>}
              {patientFollowups.map((followup) => <FollowupCard key={followup.id} followup={followup} patientId={patientId} />)}
            </section>
            {standaloneCharges.length > 0 && (
              <section className="panel">
                <div className="panel-header"><div><div className="section-kicker">COBRANÇA</div><h2>Atendimentos avulsos</h2></div></div>
                {standaloneCharges.map((followup) => <FollowupCard key={followup.id} followup={followup} patientId={patientId} />)}
              </section>
            )}
            <section className="panel">
              <div className="panel-header"><div><div className="section-kicker">HISTÓRICO</div><h2>Atendimentos realizados</h2></div></div>
              {attendances.length === 0 && <p className="text-sm text-muted-foreground">Nenhum atendimento registrado. Use “Registrar atendimento” em um acompanhamento para começar o acompanhamento com fotos e observações.</p>}
              {attendances.map((entry) => (
                <Link key={entry.details!.id} className="procedure-row no-underline" style={{ color: 'inherit' }} to="/pacientes/$patientId/atendimentos/$attendanceId" params={{ patientId, attendanceId: entry.details!.id! }}>
                  <span className="procedure-info grid gap-0.5">
                    <span>{entry.title.replace(/ realizado$/, '')}</span>
                    <span className="text-xs text-muted-foreground">{dateTime(entry.at)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Camera className="size-3.5" /> {entry.details?.photos?.length ?? 0} · Acompanhar</span>
                </Link>
              ))}
            </section>
            <section className="panel">
              <div className="panel-header"><h2>Agendamentos em aberto</h2></div>
              {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nenhum agendamento em aberto.</p>}
              {upcoming.map((entry, index) => <div className="procedure-row" key={index}><span className="procedure-info"><strong>{dateTime(entry.at)}</strong><small>{entry.title}</small></span></div>)}
            </section>
          </div>
          <section className="panel">
            <div className="panel-header"><h2>Histórico</h2></div>
            <PatientTimeline events={history.data.events} patientId={patientId} />
          </section>
        </div>
      )}
      <NewFollowupDialog open={dialog === 'followup'} patientId={patientId} patients={patients.data ?? []} combos={combos.data ?? []} plans={plans.data ?? []} onClose={() => setDialog(null)} />
      <StandaloneAttendanceDialog open={dialog === 'standalone'} patientId={patientId} procedures={procedures.data ?? []} onClose={() => setDialog(null)} />
      <AppointmentDialog open={dialog === 'appointment'} patientId={patientId} patients={patients.data ?? []} followups={followups.data ?? []} procedures={procedures.data ?? []} onClose={() => setDialog(null)} />
    </div>
  );
}
