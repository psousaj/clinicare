import { Link } from '@tanstack/react-router';
import { CalendarDays, Camera, ClipboardList, FileText, Sparkles, Wallet, type LucideIcon } from 'lucide-react';
import { dateTime } from '@/lib/format';
import type { PatientHistory } from '@/lib/schemas';

type Entry = PatientHistory['events'][number];
type GroupedEntry = Entry & { details?: Entry['details'] & { groupedCount?: number; groupedIds?: string[] } };

const kinds: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  followup: { label: 'Acompanhamento', icon: FileText, tone: 'bg-[#e6eefb] text-[#2f5c9e]' },
  appointment: { label: 'Agendamento', icon: CalendarDays, tone: 'bg-[#fbf1d9] text-[#7a5610]' },
  attendance: { label: 'Atendimento', icon: Sparkles, tone: 'bg-accent text-accent-foreground' },
  payment: { label: 'Pagamento', icon: Wallet, tone: 'bg-[#e9e4f7] text-[#5b449b]' },
  anamnesis: { label: 'Anamnese', icon: ClipboardList, tone: 'bg-[#f7e8df] text-[#a3521f]' },
};

function Body({ entry, patientId }: { entry: Entry; patientId: string }) {
  const rawPhotos = (entry.details as { photos?: Array<{ id?: string; _id?: string; url?: string | null; phase?: string }>; photoCount?: number; followupId?: string | null; followupItemId?: string | null; groupedCount?: number } | undefined);
  const photos = rawPhotos?.photos ?? [];
  const count = rawPhotos?.photoCount ?? photos.length;
  const thumbs = photos.filter((photo) => photo.url).slice(0, 4);
  const linked = entry.type === 'attendance' ? Boolean(rawPhotos?.followupId ?? rawPhotos?.followupItemId) : true;
  const content = (
    <>
      <strong className="text-sm">{entry.title}</strong>
      <span className="text-xs text-muted-foreground">{kinds[entry.type]?.label ?? entry.type} · {dateTime(entry.at)}{entry.type === 'attendance' && !linked ? ' · avulso (não abate o plano)' : ''}</span>
      {entry.type === 'attendance' && typeof entry.details?.notes === 'string' && entry.details.notes && <span className="line-clamp-2 text-xs text-foreground/80">{entry.details.notes}</span>}
      {entry.type === 'attendance' && (
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"><Camera className="size-3.5" /> {count} {count === 1 ? 'foto' : 'fotos'} · {rawPhotos?.groupedCount && rawPhotos.groupedCount > 1 ? `${rawPhotos.groupedCount} sessões agrupadas` : 'acompanhar sessão'}</span>
      )}
      {entry.type === 'attendance' && thumbs.length > 0 && (
        <span className="mt-1.5 flex gap-1.5" aria-label={`${count} fotos da sessão`}>
          {thumbs.map((photo) => (
            <img key={photo.id ?? photo._id ?? photo.url} src={photo.url!} alt="" loading="lazy" className="size-11 rounded-md border border-border object-cover" />
          ))}
          {count > thumbs.length && (
            <span className="grid size-11 place-items-center rounded-md border border-border bg-muted text-[11px] font-semibold text-muted-foreground">+{count - thumbs.length}</span>
          )}
        </span>
      )}
    </>
  );
  if (entry.type === 'attendance' && entry.details?.id) {
    return <Link to="/pacientes/$patientId/atendimentos/$attendanceId" params={{ patientId, attendanceId: entry.details.id }} className="grid gap-0.5 rounded-lg border border-border bg-white p-3 no-underline transition-colors hover:border-primary/40 hover:bg-accent/40" style={{ color: 'inherit' }}>{content}</Link>;
  }
  return <div className="grid gap-0.5 rounded-lg border border-border bg-white p-3">{content}</div>;
}

export function PatientTimeline({ events, patientId }: { events: Entry[]; patientId: string }) {
  if (!events.length) return <p className="m-0 text-sm text-muted-foreground">Nenhum registro ainda.</p>;
  const grouped: GroupedEntry[] = [];
  for (const entry of events) {
    const details = entry.details as (Entry['details'] & { appointmentId?: string; groupedCount?: number; groupedIds?: string[] }) | undefined;
    const previous = grouped.at(-1);
    const previousDetails = previous?.details as (Entry['details'] & { appointmentId?: string; groupedCount?: number; groupedIds?: string[] }) | undefined;
    if (entry.type === 'attendance' && details?.appointmentId && previous?.type === 'attendance' && previousDetails?.appointmentId === details.appointmentId) {
      const groupedCount = (previousDetails.groupedCount ?? 1) + 1;
      previous.title = `${entry.title.replace(/\s+·\s+\d+ sessões?$/, '')} · ${groupedCount} sessões`;
      previous.details = { ...previous.details, groupedCount, photoCount: (previousDetails.photoCount ?? 0) + (details.photoCount ?? 0), groupedIds: [...(previousDetails.groupedIds ?? [previous.details?.id ?? '']), details.id ?? ''] };
      continue;
    }
    grouped.push({ ...entry, title: entry.type === 'attendance' && details?.appointmentId ? `${entry.title} · 1 sessão` : entry.title, details: entry.type === 'attendance' && details?.appointmentId ? { ...entry.details, groupedCount: 1, groupedIds: [details.id ?? ''] } : entry.details });
  }
  return (
    <ol className="relative m-0 grid list-none gap-3 p-0 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
      {grouped.map((entry, index) => {
        const { icon: Icon, tone } = kinds[entry.type] ?? kinds.attendance;
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
