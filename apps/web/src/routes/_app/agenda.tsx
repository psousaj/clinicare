import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { AppointmentDetails } from '@/components/AppointmentDetails';
import { AppointmentDialog } from '@/components/dialogs';
import { CalendarView } from '@/components/CalendarView';
import { QueryError } from '@/components/QueryState';
import { statusLabel, statusTone } from '@/lib/format';
import { appointmentsQuery, patientsQuery, followupsQuery, proceduresQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/agenda')({ component: Agenda });

function Agenda() {
  const appointments = useQuery(appointmentsQuery), patients = useQuery(patientsQuery), followups = useQuery(followupsQuery), procedures = useQuery(proceduresQuery);
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
      <div className="panel-header"><div><div className="section-kicker">AGENDA DO PROFISSIONAL</div><h2>Semana de agendamentos</h2></div></div>
      <QueryError query={appointments} />
      <CalendarView events={events} onSelect={(range) => setSelection({ start: range.startStr, end: range.endStr })} onOpen={(event) => setOpenId(event.event.id)} />
      <AppointmentDetails appointment={opened} patientName={opened ? patientName(opened.patientId) : ''} procedures={opened ? procedureNames(opened.items) : []} onClose={() => setOpenId(null)} />
      <AppointmentDialog open={!!selection} selection={selection} patients={patients.data ?? []} followups={followups.data ?? []} procedures={procedures.data ?? []} onClose={() => setSelection(null)} />
    </section>
  );
}
