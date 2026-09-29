import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarPlus, ClipboardPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { AppointmentDialog, NewAttendanceDialog } from '@/components/dialogs';
import { Button } from '@/components/ui/button';
import { attendancesQuery, combosQuery, patientsQuery, plansQuery, proceduresQuery } from '@/lib/queries';

// Atalhos da visão geral: cada ação abre seu modal sem sair da página.
export function QuickActions() {
  const patients = useQuery(patientsQuery), procedures = useQuery(proceduresQuery), combos = useQuery(combosQuery), plans = useQuery(plansQuery), attendances = useQuery(attendancesQuery);
  const [dialog, setDialog] = useState<'attendance' | 'appointment' | null>(null);
  const close = () => setDialog(null);
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setDialog('attendance')}><ClipboardPlus size={17} /> Novo atendimento</Button>
      <Button variant="outline" onClick={() => setDialog('appointment')}><CalendarPlus size={17} /> Novo agendamento</Button>
      <Button asChild><Link to="/pacientes/novo"><Plus size={17} /> Novo paciente</Link></Button>
      <NewAttendanceDialog open={dialog === 'attendance'} patients={patients.data ?? []} procedures={procedures.data ?? []} combos={combos.data ?? []} plans={plans.data ?? []} onClose={close} />
      <AppointmentDialog open={dialog === 'appointment'} patients={patients.data ?? []} attendances={attendances.data ?? []} onClose={close} />
    </div>
  );
}
