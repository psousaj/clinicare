import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppointmentDialog } from '@/components/dialogs';
import { CalendarView } from '@/components/CalendarView';
import { QueryError } from '@/components/QueryState';
import { appointmentsQuery, patientsQuery, plansQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/agenda')({ component: Agenda });

function Agenda() {
  const appointments = useQuery(appointmentsQuery), patients = useQuery(patientsQuery), plans = useQuery(plansQuery);
  const [selection, setSelection] = useState<{ start: string; end: string } | null>(null);
  const events = (appointments.data ?? []).map((appointment) => ({
    id: appointment.id,
    title: `${patients.data?.find((patient) => patient.id === appointment.patientId)?.fullName ?? 'Paciente'} · ${appointment.status}`,
    start: appointment.startsAt,
    end: appointment.endsAt,
  }));
  return (
    <section className="panel">
      <div className="panel-header"><div><div className="section-kicker">AGENDA DO PROFISSIONAL</div><h2>Semana de atendimentos</h2></div></div>
      <QueryError query={appointments} />
      <CalendarView events={events} onSelect={(range) => setSelection({ start: range.startStr, end: range.endStr })} onOpen={(event) => toast.info(`Agendamento: ${event.event.title}`)} />
      <AppointmentDialog selection={selection} patients={patients.data ?? []} plans={plans.data ?? []} onClose={() => setSelection(null)} />
    </section>
  );
}
