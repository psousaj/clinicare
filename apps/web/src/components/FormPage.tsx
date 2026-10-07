import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

type FormPageProps = {
  backTo: '/pacientes' | '/procedimentos' | '/contratos' | '/planos';
  backLabel: string;
  backSearch?: Record<string, string>;
  title: string;
  submitLabel: string;
  onSubmit: (form: FormData) => Promise<unknown> | unknown;
  narrow?: boolean;
  className?: string;
  children: ReactNode;
  below?: ReactNode;
};

// Cadastro em página inteira: cabeçalho com voltar/cancelar/salvar, campos no painel e conteúdo extra (ex.: editor) abaixo.
export function FormPage({ backTo, backLabel, backSearch, title, submitLabel, onSubmit, narrow, className, children, below }: FormPageProps) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await onSubmit(form);
      await navigate({ to: backTo, ...(backSearch && { search: backSearch as never }) });
    } catch (error) {
      // Erros da API já são exibidos pelo hook de mutation.
      if (!(error instanceof ApiError)) toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={cn('grid gap-4', className)} onSubmit={handleSubmit}>
      <section className="panel grid gap-4">
        <div className="panel-header form-page-header">
          <div>
            <Link to={backTo} search={backSearch as never} className="text-button mb-2"><ArrowLeft size={14} /> {backLabel}</Link>
            <h2>{title}</h2>
          </div>
          <div className="form-page-actions">
            <Button type="button" variant="outline" asChild><Link to={backTo} search={backSearch as never}>Cancelar</Link></Button>
            <Button type="submit" disabled={pending}>{submitLabel}</Button>
          </div>
        </div>
        <div className={cn('grid gap-4', narrow && 'max-w-2xl')}>{children}</div>
      </section>
      {below}
    </form>
  );
}
