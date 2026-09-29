import { Link } from '@tanstack/react-router';
import { CalendarDays, Clock, Sparkles, StickyNote, Trash2, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { statusLabel, statusTone } from '@/lib/format';
import { useDeleteAppointment } from '@/lib/queries';
import type { Appointment } from '@/lib/schemas';

type Props = { appointment: Appointment | null; patientName: string; procedures: string[]; onClose: () => void };

const dateLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <div className="grid gap-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-sm">{children}</span>
      </div>
    </div>
  );
}

// Só visualização e exclusão: alterações de horário se fazem excluindo e agendando de novo.
export function AppointmentDetails({ appointment, patientName, procedures, onClose }: Props) {
  const remove = useDeleteAppointment();
  const [confirming, setConfirming] = useState(false);
  const close = () => { setConfirming(false); onClose(); };
  const start = appointment && new Date(appointment.startsAt), end = appointment && new Date(appointment.endsAt);

  return (
    <Dialog open={!!appointment} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        {appointment && start && end && (
          <>
            <DialogHeader>
              <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-primary">AGENDAMENTO</div>
              <DialogTitle className="flex flex-wrap items-center gap-2 font-[Manrope] text-xl font-bold tracking-tight">
                {patientName} <StatusBadge tone={statusTone(appointment.status)}>{statusLabel(appointment.status)}</StatusBadge>
              </DialogTitle>
              <DialogDescription className="sr-only">Detalhes do agendamento</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <Row icon={<CalendarDays className="size-4" />} label="Data"><span className="first-letter:uppercase">{dateLong.format(start)}</span></Row>
              <Row icon={<Clock className="size-4" />} label="Horário">{time.format(start)} às {time.format(end)}</Row>
              <Row icon={<Sparkles className="size-4" />} label="Procedimento">{procedures.length ? procedures.join(', ') : 'Não informado'}</Row>
              <Row icon={<UserRound className="size-4" />} label="Paciente">
                <Link to="/pacientes/$patientId" params={{ patientId: appointment.patientId }} className="text-primary underline-offset-2 hover:underline" onClick={close}>Abrir ficha do paciente</Link>
              </Row>
              {typeof appointment.notes === 'string' && appointment.notes && <Row icon={<StickyNote className="size-4" />} label="Observações">{appointment.notes}</Row>}
            </div>
            {confirming && <p role="alert" className="m-0 rounded-lg bg-[#f8e4e1] p-3 text-sm text-[#8a2a1f]">Excluir este agendamento? Essa ação não pode ser desfeita.</p>}
            <DialogFooter>
              {confirming ? (
                <>
                  <Button type="button" variant="outline" onClick={() => setConfirming(false)}>Voltar</Button>
                  <Button type="button" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(appointment.id, { onSuccess: close })}><Trash2 /> Sim, excluir</Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}><Trash2 /> Excluir</Button>
                  <Button type="button" onClick={close}>Fechar</Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
