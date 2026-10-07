import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Camera, CalendarPlus, ChartNoAxesCombined, ClipboardPlus, Pencil, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { EditPatientDialog } from '@/components/EditPatientDialog';
import { FollowupCard } from '@/components/FollowupCard';
import { StatusBadge } from '@/components/StatusBadge';
import { AppointmentDialog, NewFollowupDialog, StandaloneAttendanceDialog } from '@/components/dialogs';
import { ContractSummary } from '@/components/ContractSummary';
import { PatientTimeline } from '@/components/PatientTimeline';
import { PendingRequirements } from '@/components/PendingRequirements';
import { QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { dateTime } from '@/lib/format';
import { followupsQuery, combosQuery, patientHistoryQuery, patientsQuery, plansQuery, proceduresQuery } from '@/lib/queries';
import type { Followup } from '@/lib/schemas';

export const Route = createFileRoute('/_app/pacientes/$patientId/')({ component: PatientDetail });

function PatientDetail() {
  const { patientId } = Route.useParams();
  const history = useQuery(patientHistoryQuery(patientId)),
    followups = useQuery({
      ...followupsQuery,
      // Enquanto algum contrato estiver gerando em background, atualiza a lista
      // sozinha até concluir (sem cron, sem refresh manual).
      refetchInterval: (query) => {
        const data = query.state.data as Followup[] | undefined;
        return data?.some((followup) => followup.contracts.some((contract) => contract.status === 'generating')) ? 4000 : false;
      },
    });
  const patients = useQuery(patientsQuery), procedures = useQuery(proceduresQuery), combos = useQuery(combosQuery), plans = useQuery(plansQuery);
  const [dialog, setDialog] = useState<'edit' | 'followup' | 'standalone' | 'appointment' | null>(null);
  const allFollowups = (followups.data ?? []).filter((followup) => followup.patientId === patientId);
  const patientFollowups = allFollowups.filter((followup) => followup.offerType !== 'procedure');
  const standaloneCharges = allFollowups.filter((followup) => followup.offerType === 'procedure');

  const patient = history.data?.patient;
  const upcoming = (history.data?.pending ?? []).filter((entry) => entry.type === 'appointment');
  const attendances = (history.data?.events ?? []).filter((entry) => entry.type === 'attendance' && entry.details?.id);
  type AttendanceDetails = { photos?: Array<{ url?: string | null }>; photoCount?: number; followupId?: string | null; followupItemId?: string | null } | undefined;
  const isLinked = (entry: (typeof attendances)[number]) => Boolean((entry.details as AttendanceDetails)?.followupId ?? (entry.details as AttendanceDetails)?.followupItemId);
  // Atendimentos avulsos com o mesmo nome de um procedimento contratado não
  // abatem o plano — é o que deixa o "0/12" confuso. Sinaliza no card.
  const planProcedureNames = new Set(patientFollowups.flatMap((followup) => followup.items.map((item) => item.procedureName.toLowerCase())));
  const unlinkedMatchingPlan = attendances.filter((entry) => !isLinked(entry) && planProcedureNames.has(entry.title.replace(/ (realizado|cancelado)$/, '').toLowerCase()));
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
            <Button variant="outline" onClick={() => setDialog('edit')} disabled={!patient}><Pencil /> Editar paciente</Button>
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
            <ContractSummary followups={patientFollowups} />            <section className="panel">
              <div className="panel-header"><h2>Acompanhamentos</h2></div>
              {unlinkedMatchingPlan.length > 0 && (
                <p role="alert" className="m-0 mb-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  {unlinkedMatchingPlan.length} {unlinkedMatchingPlan.length === 1 ? 'atendimento avulso' : 'atendimentos avulsos'} com {unlinkedMatchingPlan.length === 1 ? 'nome' : 'nomes'} igual ao do plano ({[...new Set(unlinkedMatchingPlan.map((entry) => entry.title.replace(/ (realizado|cancelado)$/, '')))].join(', ')}) — {unlinkedMatchingPlan.length === 1 ? 'não abate' : 'não abatem'} as sessões contratadas. Para abater, marque a sessão dentro do acompanhamento — no agendamento ou em “Registrar atendimento”. O que for avulso nunca abate.
                </p>
              )}
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
              {attendances.map((entry) => {
                const details = entry.details as AttendanceDetails;
                const count = details?.photoCount ?? details?.photos?.length ?? 0;
                const linked = isLinked(entry);
                return (
                  <Link key={entry.details!.id} className="procedure-row no-underline" style={{ color: 'inherit' }} to="/pacientes/$patientId/atendimentos/$attendanceId" params={{ patientId, attendanceId: entry.details!.id! }}>
                    <span className="procedure-info grid gap-0.5">
                      <span className="flex flex-wrap items-center gap-2">{entry.title.replace(/ (realizado|cancelado)$/, '')} <StatusBadge tone={linked ? 'neutral' : 'warning'}>{linked ? 'Plano' : 'Avulso'}</StatusBadge></span>
                      <span className="text-xs text-muted-foreground">{dateTime(entry.at)}{linked ? '' : ' · não abate o plano'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Camera className="size-3.5" /> {count} · Acompanhar</span>
                  </Link>
                );
              })}
            </section>
            <section className="panel">
              <div className="panel-header"><h2>Agendamentos em aberto</h2></div>
              {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nenhum agendamento em aberto.</p>}
              {upcoming.map((entry, index) => <div className="procedure-row" key={index}><span className="procedure-info"><strong>{dateTime(entry.at)}</strong><small>{entry.title}</small></span></div>)}
            </section>
          </div>
          <div className="grid gap-4">
            <section className="panel">
              <div className="panel-header"><h2>Histórico</h2></div>
              <PatientTimeline events={history.data.events} patientId={patientId} />
            </section>
            <section className="panel">
              <div className="panel-header"><div><div className="section-kicker">SESSÕES</div><h2>Fotos por sessão</h2></div></div>
              {attendances.length === 0 && <p className="m-0 text-sm text-muted-foreground">Nenhuma sessão para anexar fotos ainda.</p>}
              {attendances.map((entry) => {
                const details = entry.details as { photos?: Array<{ id?: string; _id?: string; url?: string | null }>; photoCount?: number; followupId?: string | null; followupItemId?: string | null } | undefined;
                const photos = details?.photos ?? [];
                const count = details?.photoCount ?? photos.length;
                const linked = Boolean(details?.followupId ?? details?.followupItemId);
                const thumbs = photos.filter((photo) => photo.url).slice(0, 4);
                return (
                  <div key={entry.details!.id} className="procedure-row" style={{ alignItems: 'flex-start' }}>
                    <span className="procedure-info grid gap-1.5">
                      <span className="flex flex-wrap items-center gap-2"><strong>{entry.title.replace(/ (realizado|cancelado)$/, '')}</strong> <StatusBadge tone={linked ? 'neutral' : 'warning'}>{linked ? 'Plano' : 'Avulso'}</StatusBadge></span>
                      <span className="text-xs text-muted-foreground">{dateTime(entry.at)} · {count} {count === 1 ? 'foto' : 'fotos'}{linked ? '' : ' · não abate o plano'}</span>
                      {thumbs.length > 0 ? (
                        <span className="flex gap-1.5">
                          {thumbs.map((photo) => (
                            <img key={photo.id ?? photo._id ?? photo.url} src={photo.url!} alt="" loading="lazy" className="size-11 rounded-md border border-border object-cover" />
                          ))}
                          {count > thumbs.length && <span className="grid size-11 place-items-center rounded-md border border-border bg-muted text-[11px] font-semibold text-muted-foreground">+{count - thumbs.length}</span>}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">Sem fotos — anexe o antes, durante e depois da sessão.</span>}
                    </span>
                    <Link className="text-button shrink-0" to="/pacientes/$patientId/atendimentos/$attendanceId" params={{ patientId, attendanceId: entry.details!.id! }}>Anexar fotos</Link>
                  </div>
                );
              })}
            </section>
          </div>
        </div>
      )}
      <NewFollowupDialog open={dialog === 'followup'} patientId={patientId} patients={patients.data ?? []} combos={combos.data ?? []} plans={plans.data ?? []} onClose={() => setDialog(null)} />
      {patient && <EditPatientDialog open={dialog === 'edit'} onOpenChange={(open) => setDialog(open ? 'edit' : null)} patient={patient} />}
      <StandaloneAttendanceDialog open={dialog === 'standalone'} patientId={patientId} procedures={procedures.data ?? []} onClose={() => setDialog(null)} />
      <AppointmentDialog open={dialog === 'appointment'} patientId={patientId} patients={patients.data ?? []} followups={followups.data ?? []} procedures={procedures.data ?? []} onClose={() => setDialog(null)} />
    </div>
  );
}
