import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { photoPhases } from '@/lib/format';
import { useAddSessionPhoto, useDeleteSessionPhoto } from '@/lib/queries';
import type { SessionPhoto } from '@/lib/schemas';
import { cn } from '@/lib/utils';

type Phase = keyof typeof photoPhases;
const phases = Object.keys(photoPhases) as Phase[];
const allowed = ['image/jpeg', 'image/png', 'image/webp'];
const maxBytes = 10_000_000;

// Anexa e lista as fotos da sessão, agrupadas por momento (antes/durante/depois).
export function SessionPhotos({ sessionId, photos }: { sessionId: string; photos: SessionPhoto[] }) {
  const add = useAddSessionPhoto(sessionId), remove = useDeleteSessionPhoto(sessionId);
  const [phase, setPhase] = useState<Phase>('before');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    const chosen = Array.from(files ?? []);
    if (input.current) input.current.value = '';
    const invalid = chosen.find((file) => !allowed.includes(file.type) || file.size > maxBytes);
    if (invalid) return toast.error(`“${invalid.name}” não é uma imagem JPG, PNG ou WebP de até 10 MB.`);
    setUploading(true);
    try {
      for (const file of chosen) await add.mutateAsync({ file, phase, notes });
      setNotes('');
    } catch {
      // O erro já aparece como toast no hook.
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="panel grid gap-4">
      <div className="panel-header"><div><div className="section-kicker">FOTOS DO ATENDIMENTO</div><h2>Antes, durante e depois</h2></div></div>
      <div className="grid gap-3 rounded-lg border border-dashed border-[#cfdcd3] bg-[#f7f8f5] p-4">
        <div role="radiogroup" aria-label="Momento da foto" className="inline-flex w-fit divide-x overflow-hidden rounded-lg border border-border bg-white">
          {phases.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={phase === key}
              onClick={() => setPhase(key)}
              className={cn('border-0 px-4 py-1.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring', phase === key ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent')}
            >
              {photoPhases[key]}
            </button>
          ))}
        </div>
        <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Legenda (opcional). Ex.: lado direito do rosto" aria-label="Legenda da foto" maxLength={200} />
        <input ref={input} type="file" accept={allowed.join(',')} multiple hidden aria-label="Selecionar fotos" onChange={(event) => void upload(event.target.files)} />
        <Button type="button" variant="outline" className="w-fit" disabled={uploading} onClick={() => input.current?.click()}>
          <ImagePlus /> {uploading ? 'Enviando…' : `Anexar foto (${photoPhases[phase].toLowerCase()})`}
        </Button>
      </div>
      {photos.length === 0 && <p className="m-0 text-sm text-muted-foreground">Nenhuma foto anexada ainda.</p>}
      {phases.map((key) => {
        const group = photos.filter((photo) => photo.phase === key);
        if (!group.length) return null;
        return (
          <div key={key} className="grid gap-2">
            <h3 className="m-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{photoPhases[key]} · {group.length}</h3>
            <div className="grid grid-cols-2 gap-3">
              {group.map((photo) => (
                <figure key={photo.id} className="group relative m-0 grid gap-1">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted">
                    {photo.url ? (
                      <a href={photo.url} target="_blank" rel="noreferrer" className="block size-full" aria-label={`Abrir foto ${photoPhases[key].toLowerCase()}`}>
                        <img src={photo.url} alt={photo.notes || `Foto ${photoPhases[key].toLowerCase()}`} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
                      </a>
                    ) : <span className="grid size-full place-items-center px-2 text-center text-xs text-muted-foreground">Pré-visualização indisponível</span>}
                    <Button type="button" size="icon" variant="secondary" className="absolute right-1.5 top-1.5 size-7 opacity-0 shadow group-hover:opacity-100 focus-visible:opacity-100" aria-label="Remover foto" disabled={remove.isPending} onClick={() => remove.mutate(photo.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {photo.notes && <figcaption className="text-xs text-muted-foreground">{photo.notes}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
