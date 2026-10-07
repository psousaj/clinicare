import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { AppointmentDialog } from '@/components/dialogs';
import { CalendarView } from '@/components/CalendarView';
import { QueryError } from '@/components/QueryState';
import { statusLabel, statusTone } from '@/lib/format';
import { appointmentsQuery, patientsQuery, followupsQuery, proceduresQuery, useConfirmAppointment, useNoShowAppointment } from '@/lib/queries';

export const Route = createFileRoute('/_app/agenda')({ component: Agenda });

function Agenda() {
  const appointments = useQuery(appointmentsQuery), patients = useQuery(patientsQuery), followups = useQuery(followupsQuery), procedures = useQuery(proceduresQuery);
  const confirmAppointment = useConfirmAppointment(), noShowAppointment = useNoShowAppointment();
  const [selection, setSelection] = useState<{ start: string; end: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const patientName = (id: string) => patients.data?.find((patient) => patient.id === id)?.fullName ?? 'Paciente';
  const procedureNames = (items: { procedureName: string; quantity: number }[] = []) => items.map((item) => (item.quantity > 1 ? `${item.procedureName} ×${item.quantity}` : item.procedureName));
  const events = (appointments.data ?? []).map((appointment) => ({
    id: appointment.id,
    title: patientName(appointment.patientId),
    start: appointment.startsAt,
    end: appointment.endsAt,
    extendedProps: { patient: patientName(appointment.patientId), procedure: procedureNames(appointment.items).join(', ') || 'Procedimento', statusLabel: statusLabel(appointment.status), tone: statusTone(appointment.status) },
  }));
  const opened = appointments.data?.find((appointment) => appointment.id === openId) ?? null;
  const overdue = (appointments.data ?? []).filter((appointment) => ['planned', 'rescheduled'].includes(appointment.status) && new Date(appointment.endsAt) < new Date());
  return (
    <section className="panel">
      <div className="panel-header"><div><div className="section-kicker">AGENDA DO PROFISSIONAL</div><h2>Semana de agendamentos</h2><p className="m-0 text-sm text-muted-foreground">Agendamentos passados aguardam confirmação do atendimento ou registro de falta.</p></div><div>{overdue.length ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs">{overdue.length} aguardando confirmação</span> : null}</div></div>
      <QueryError query={appointments} />
      {overdue.length > 0 && <section aria-label="Agendamentos vencidos" className="mb-4 rounded-xl border border-amber-300 bg-amber-50/50 p-4">
        <div className="mb-3"><h3 className="m-0 text-sm font-semibold">Precisam de confirmação</h3><p className="m-0 mt-1 text-xs text-muted-foreground">Escolha se o atendimento aconteceu ou registre o motivo da falta.</p></div>
        <div className="grid gap-3">{overdue.map((appointment) => <article key={appointment.id} className="grid gap-2 rounded-lg border border-border bg-white p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
          <div><strong className="text-sm">{patientName(appointment.patientId)}</strong><p className="m-0 text-xs text-muted-foreground">{new Date(appointment.startsAt).toLocaleString('pt-BR')} · {procedureNames(appointment.items).join(', ')}</p></div>
          <Textarea aria-label={`Motivo da falta — ${patientName(appointment.patientId)}`} rows={2} placeholder="Se faltou, descreva o motivo…" value={reasons[appointment.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [appointment.id]: event.target.value }))} />
          <div className="flex gap-2 sm:flex-col"><Button type="button" size="sm" onClick={() => { setSelection(null); setOpenId(appointment.id); }}>Confirmar atendimento</Button><Button type="button" size="sm" variant="outline" disabled={!reasons[appointment.id]?.trim() || noShowAppointment.isPending} onClick={() => noShowAppointment.mutate({ id: appointment.id, reason: reasons[appointment.id]!.trim() }, { onSuccess: () => setReasons((current) => ({ ...current, [appointment.id]: '' })) })}>Registrar falta</Button></div>
        </article>)}</div>
      </section>}
      <CalendarView
        events={events}
        onSelect={(range) => { setOpenId(null); setSelection({ start: range.startStr, end: range.endStr }); }}
        onDateClick={(click) => { const end = new Date(click.date.getTime() + 60 * 60000); setOpenId(null); setSelection({ start: click.date.toISOString(), end: end.toISOString() }); }}
        onSlotClick={(date) => { const end = new Date(date.getTime() + 60 * 60000); setOpenId(null); setSelection({ start: date.toISOString(), end: end.toISOString() }); }}
        onOpen={(event) => setOpenId(event.event.id)}
      />
      <AppointmentDialog open={!!selection || !!opened} selection={selection} appointment={opened} patients={patients.data ?? []} followups={followups.data ?? []} procedures={procedures.data ?? []} onClose={() => { setSelection(null); setOpenId(null); }} />
    </section>
  );
}
