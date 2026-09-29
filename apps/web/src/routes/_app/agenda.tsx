import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { AppointmentDetails } from '@/components/AppointmentDetails';
import { AppointmentDialog } from '@/components/dialogs';
import { CalendarView } from '@/components/CalendarView';
import { QueryError } from '@/components/QueryState';
import { statusLabel, statusTone } from '@/lib/format';
import { appointmentsQuery, patientsQuery, attendancesQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/agenda')({ component: Agenda });

function Agenda() {
  const appointments = useQuery(appointmentsQuery), patients = useQuery(patientsQuery), attendances = useQuery(attendancesQuery);
  const [selection, setSelection] = useState<{ start: string; end: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const patientName = (id: string) => patients.data?.find((patient) => patient.id === id)?.fullName ?? 'Paciente';
  const procedureNames = (attendanceItemIds: unknown) => {
    const ids = Array.isArray(attendanceItemIds) ? attendanceItemIds.map(String) : [];
    return (attendances.data ?? []).flatMap((attendance) => attendance.items).filter((item) => ids.includes(item.id)).map((item) => item.procedureName);
  };
  const events = (appointments.data ?? []).map((appointment) => ({
    id: appointment.id,
    title: patientName(appointment.patientId),
    start: appointment.startsAt,
    end: appointment.endsAt,
    extendedProps: { patient: patientName(appointment.patientId), procedure: procedureNames(appointment.attendanceItemIds).join(', ') || 'Procedimento', statusLabel: statusLabel(appointment.status), tone: statusTone(appointment.status) },
  }));
  const opened = appointments.data?.find((appointment) => appointment.id === openId) ?? null;
  return (
    <section className="panel">
      <div className="panel-header"><div><div className="section-kicker">AGENDA DO PROFISSIONAL</div><h2>Semana de atendimentos</h2></div></div>
      <QueryError query={appointments} />
      <CalendarView events={events} onSelect={(range) => setSelection({ start: range.startStr, end: range.endStr })} onOpen={(event) => setOpenId(event.event.id)} />
      <AppointmentDetails appointment={opened} patientName={opened ? patientName(opened.patientId) : ''} procedures={opened ? procedureNames(opened.attendanceItemIds) : []} onClose={() => setOpenId(null)} />
      <AppointmentDialog open={!!selection} selection={selection} patients={patients.data ?? []} attendances={attendances.data ?? []} onClose={() => setSelection(null)} />
    </section>
  );
}
