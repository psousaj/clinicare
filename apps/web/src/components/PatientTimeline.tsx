import { Link } from '@tanstack/react-router';
import { CalendarDays, Camera, ClipboardList, FileText, Sparkles, Wallet, type LucideIcon } from 'lucide-react';
import { dateTime } from '@/lib/format';
import type { PatientHistory } from '@/lib/schemas';

type Entry = PatientHistory['events'][number];

const kinds: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  attendance: { label: 'Atendimento', icon: FileText, tone: 'bg-[#e6eefb] text-[#2f5c9e]' },
  appointment: { label: 'Agendamento', icon: CalendarDays, tone: 'bg-[#fbf1d9] text-[#7a5610]' },
  session: { label: 'Sessão', icon: Sparkles, tone: 'bg-accent text-accent-foreground' },
  payment: { label: 'Pagamento', icon: Wallet, tone: 'bg-[#e9e4f7] text-[#5b449b]' },
  anamnesis: { label: 'Anamnese', icon: ClipboardList, tone: 'bg-[#f7e8df] text-[#a3521f]' },
};

function Body({ entry, patientId }: { entry: Entry; patientId: string }) {
  const photos = entry.details?.photos?.length ?? 0;
  const content = (
    <>
      <strong className="text-sm">{entry.title}</strong>
      <span className="text-xs text-muted-foreground">{kinds[entry.type]?.label ?? entry.type} · {dateTime(entry.at)}</span>
      {entry.type === 'session' && typeof entry.details?.notes === 'string' && entry.details.notes && <span className="line-clamp-2 text-xs text-foreground/80">{entry.details.notes}</span>}
      {entry.type === 'session' && (
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"><Camera className="size-3.5" /> {photos} {photos === 1 ? 'foto' : 'fotos'} · acompanhar sessão</span>
      )}
    </>
  );
  if (entry.type === 'session' && entry.details?.id) {
    return <Link to="/pacientes/$patientId/sessoes/$sessionId" params={{ patientId, sessionId: entry.details.id }} className="grid gap-0.5 rounded-lg border border-border bg-white p-3 no-underline transition-colors hover:border-primary/40 hover:bg-accent/40" style={{ color: 'inherit' }}>{content}</Link>;
  }
  return <div className="grid gap-0.5 rounded-lg border border-border bg-white p-3">{content}</div>;
}

export function PatientTimeline({ events, patientId }: { events: Entry[]; patientId: string }) {
  if (!events.length) return <p className="m-0 text-sm text-muted-foreground">Nenhum registro ainda.</p>;
  return (
    <ol className="relative m-0 grid list-none gap-3 p-0 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
      {events.map((entry, index) => {
        const { icon: Icon, tone } = kinds[entry.type] ?? kinds.session;
        return (
          <li key={index} className="relative grid grid-cols-[32px_1fr] items-start gap-3">
            <span className={`z-10 grid size-8 place-items-center rounded-full ring-4 ring-white ${tone}`}><Icon className="size-4" /></span>
            <Body entry={entry} patientId={patientId} />
          </li>
        );
      })}
    </ol>
  );
}
