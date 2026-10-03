import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
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
  return (
    <section className="panel">
      <div className="panel-header"><div><div className="section-kicker">AGENDA DO PROFISSIONAL</div><h2>Semana de agendamentos</h2><p className="m-0 text-sm text-muted-foreground">Itens vencidos ficam disponíveis para confirmação; todos começam selecionados.</p></div><div>{appointments.data?.filter((item) => item.status === 'planned' && new Date(item.endsAt) < new Date()).length ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs">Confirmações pendentes</span> : null}</div></div>
      <QueryError query={appointments} />
      <CalendarView
        events={events}
        onSelect={(range) => { setOpenId(null); setSelection({ start: range.startStr, end: range.endStr }); }}
        onDateClick={(click) => { const end = new Date(click.date.getTime() + 60 * 60000); setOpenId(null); setSelection({ start: click.date.toISOString(), end: end.toISOString() }); }}
        onOpen={(event) => setOpenId(event.event.id)}
      />
      <AppointmentDialog open={!!selection || !!opened} selection={selection} appointment={opened} patients={patients.data ?? []} followups={followups.data ?? []} procedures={procedures.data ?? []} onClose={() => { setSelection(null); setOpenId(null); }} />
    </section>
  );
}
