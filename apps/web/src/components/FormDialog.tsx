import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  kicker?: string;
  description?: ReactNode;
  submitLabel: string;
  wide?: boolean;
  actions?: ReactNode;
  onSubmit: (form: FormData) => Promise<unknown> | unknown;
  children: ReactNode;
};

export function FormDialog({ open, onOpenChange, title, kicker, description, submitLabel, wide, actions, onSubmit, children }: FormDialogProps) {
  const [pending, setPending] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch (error) {
      // Erros da API já são exibidos pelo hook de mutation.
      if (!(error instanceof ApiError)) toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('max-h-[90vh] overflow-y-auto', wide && 'sm:max-w-3xl')}>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            {kicker && <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-primary">{kicker}</div>}
            <DialogTitle className="font-[Manrope] text-xl font-bold tracking-tight">{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>
            {actions && <div className="dialog-extra-actions">{actions}</div>}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { Field } from '@/components/Field';
