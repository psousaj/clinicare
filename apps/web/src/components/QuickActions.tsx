import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarPlus, ClipboardPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { AppointmentDialog, NewFollowupDialog } from '@/components/dialogs';
import { Button } from '@/components/ui/button';
import { followupsQuery, combosQuery, patientsQuery, plansQuery, proceduresQuery } from '@/lib/queries';

// Atalhos da visão geral: cada ação abre seu modal sem sair da página.
export function QuickActions() {
  const patients = useQuery(patientsQuery), procedures = useQuery(proceduresQuery), combos = useQuery(combosQuery), plans = useQuery(plansQuery), followups = useQuery(followupsQuery);
  const [dialog, setDialog] = useState<'followup' | 'appointment' | null>(null);
  const close = () => setDialog(null);
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setDialog('followup')}><ClipboardPlus size={17} /> Novo acompanhamento</Button>
      <Button variant="outline" onClick={() => setDialog('appointment')}><CalendarPlus size={17} /> Novo agendamento</Button>
      <Button asChild><Link to="/pacientes/novo"><Plus size={17} /> Novo paciente</Link></Button>
      <NewFollowupDialog open={dialog === 'followup'} patients={patients.data ?? []} combos={combos.data ?? []} plans={plans.data ?? []} onClose={close} />
      <AppointmentDialog open={dialog === 'appointment'} patients={patients.data ?? []} followups={followups.data ?? []} procedures={procedures.data ?? []} onClose={close} />
    </div>
  );
}
