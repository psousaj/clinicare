import { History, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { dateTime } from '@/lib/format';
import { useRestoreAnamnesis } from '@/lib/queries';
import type { Anamnesis } from '@/lib/schemas';
import { fieldCount, originLabel } from '@/lib/versions';
import { cn } from '@/lib/utils';

type Props = { anamnesis: Anamnesis; open: boolean; onOpenChange: (open: boolean) => void };

export function VersionsDialog({ anamnesis, open, onOpenChange }: Props) {
  const restore = useRestoreAnamnesis();
  const [selected, setSelected] = useState<number | null>(null);
  const versions = [...anamnesis.versions].reverse();
  const current = anamnesis.versions.at(-1)!.version;

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setSelected(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-[Manrope] text-xl font-bold tracking-tight">Versões · {anamnesis.title}</DialogTitle>
          <DialogDescription>Escolha uma versão anterior para fazer rollback. Ela será copiada como uma nova versão; nenhuma versão existente é alterada.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Versões disponíveis" className="grid gap-2">
          {versions.map((version) => {
            const isCurrent = version.version === current;
            return (
              <button
                key={version.version}
                type="button"
                role="radio"
                aria-checked={selected === version.version}
                disabled={isCurrent}
                onClick={() => setSelected(version.version)}
                className={cn('flex items-center gap-3 rounded-lg border bg-white px-3 py-2 text-left', selected === version.version && 'border-primary ring-2 ring-primary/30', isCurrent && 'cursor-default bg-muted/40')}
              >
                <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-sm font-semibold text-primary">v{version.version}</span>
                <span className="grid flex-1 gap-0.5">
                  <strong className="text-sm">{originLabel(version)}{isCurrent && <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-primary-foreground">Atual</span>}</strong>
                  <small className="text-xs text-muted-foreground">{version.createdAt ? `${dateTime(version.createdAt)} · ` : ''}{fieldCount(version)} {fieldCount(version) === 1 ? 'campo' : 'campos'}</small>
                </span>
              </button>
            );
          })}
        </div>
        {selected !== null && <p className="m-0 rounded-md bg-primary/5 p-3 text-sm">Será criada a <strong>v{current + 1}</strong> como cópia da <strong>v{selected}</strong> (rollback).</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={selected === null || restore.isPending} onClick={() => restore.mutate({ id: anamnesis.id, version: selected! }, { onSuccess: () => { onOpenChange(false); setSelected(null); } })}>
            <Undo2 /> Fazer rollback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VersionsButton({ anamnesis }: { anamnesis: Anamnesis }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><History /> Versões</Button>
      {open && <VersionsDialog anamnesis={anamnesis} open onOpenChange={setOpen} />}
    </>
  );
}
