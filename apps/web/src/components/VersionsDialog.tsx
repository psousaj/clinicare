import { History, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { dateTime } from '@/lib/format';
import { useRestoreAnamnesis, useRestoreContract } from '@/lib/queries';
import type { Anamnesis, Contract } from '@/lib/schemas';
import { fieldCount, originLabel, type VersionOrigin } from '@/lib/versions';
import { cn } from '@/lib/utils';

type Version = VersionOrigin & { version: number; createdAt?: string | null };
type Props = { title: string; versions: Version[]; detail: (version: any) => string; pending: boolean; onRestore: (version: number, done: () => void) => void; open: boolean; onOpenChange: (open: boolean) => void };

// Lista de versões com rollback: a escolhida é copiada como nova versão, sem alterar nenhuma existente.
export function VersionsDialog({ title, versions: all, detail, pending, onRestore, open, onOpenChange }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const versions = [...all].reverse();
  const current = all.at(-1)!.version;

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setSelected(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-[Manrope] text-xl font-bold tracking-tight">Versões · {title}</DialogTitle>
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
                  <small className="text-xs text-muted-foreground">{version.createdAt ? `${dateTime(version.createdAt)} · ` : ''}{detail(version)}</small>
                </span>
              </button>
            );
          })}
        </div>
        {selected !== null && <p className="m-0 rounded-md bg-primary/5 p-3 text-sm">Será criada a <strong>v{current + 1}</strong> como cópia da <strong>v{selected}</strong> (rollback).</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={selected === null || pending} onClick={() => onRestore(selected!, () => { onOpenChange(false); setSelected(null); })}>
            <Undo2 /> Fazer rollback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionsTrigger({ children }: { children: (setOpen: (open: boolean) => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><History /> Versões</Button>
      {open && children(setOpen)}
    </>
  );
}

export function VersionsButton({ anamnesis }: { anamnesis: Anamnesis }) {
  const restore = useRestoreAnamnesis();
  return (
    <VersionsTrigger>
      {(setOpen) => (
        <VersionsDialog
          title={anamnesis.title} versions={anamnesis.versions} open onOpenChange={setOpen} pending={restore.isPending}
          detail={(version) => `${fieldCount(version)} ${fieldCount(version) === 1 ? 'campo' : 'campos'}`}
          onRestore={(version, done) => restore.mutate({ id: anamnesis.id, version }, { onSuccess: done })}
        />
      )}
    </VersionsTrigger>
  );
}

export function ContractVersionsButton({ contract }: { contract: Contract }) {
  const restore = useRestoreContract();
  return (
    <VersionsTrigger>
      {(setOpen) => (
        <VersionsDialog
          title={contract.title} versions={contract.versions} open onOpenChange={setOpen} pending={restore.isPending}
          detail={(version) => `${(version.content ?? '').length} caracteres`}
          onRestore={(version, done) => restore.mutate({ id: contract.id, version }, { onSuccess: done })}
        />
      )}
    </VersionsTrigger>
  );
}
