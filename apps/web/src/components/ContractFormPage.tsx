import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { combosQuery, proceduresQuery } from '@/lib/queries';
import type { Contract } from '@/lib/schemas';

export type ContractData = { title: string; kind: Contract['kind']; procedureId: string | null; comboId: string | null; content: string };

type Props = {
  heading: string;
  submitLabel: string;
  initial?: Partial<ContractData>;
  notice?: ReactNode;
  actions?: ReactNode;
  saving?: boolean;
  onSave: (data: ContractData) => Promise<unknown>;
};

// Página de cadastro/edição de contrato: dados e aplicação no topo, texto do documento e prévia lado a lado.
export function ContractFormPage({ heading, submitLabel, initial = {}, notice, actions, saving, onSave }: Props) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [kind, setKind] = useState<Contract['kind']>(initial.kind ?? 'standard');
  const [procedureId, setProcedureId] = useState(initial.procedureId ?? '');
  const [comboId, setComboId] = useState(initial.comboId ?? '');
  const [content, setContent] = useState(initial.content ?? '');
  const procedures = useQuery(proceduresQuery).data ?? [];
  const combos = useQuery(combosQuery).data ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (title.trim().length < 2) throw new Error('Informe o nome do contrato.');
      if (kind === 'procedure' && !procedureId) throw new Error('Escolha o procedimento deste contrato.');
      if (kind === 'combo' && !comboId) throw new Error('Escolha o combo deste contrato.');
      if (!content.trim()) throw new Error('Escreva o conteúdo do contrato.');
      await onSave({ title: title.trim(), kind, procedureId: kind === 'procedure' ? procedureId : null, comboId: kind === 'combo' ? comboId : null, content });
    } catch (error) {
      if (!(error instanceof ApiError)) toast.error((error as Error).message);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <section className="panel grid gap-4">
        <div className="panel-header form-page-header">
          <div>
            <Link to="/contratos" className="text-button mb-2"><ArrowLeft size={14} /> Contratos</Link>
            <h2>{heading}</h2>
          </div>
          <div className="form-page-actions">
            {actions && <div className="form-page-extra-actions">{actions}</div>}
            <Button type="button" variant="outline" asChild><Link to="/contratos">Cancelar</Link></Button>
            <Button type="submit" disabled={saving}>{submitLabel}</Button>
          </div>
        </div>
        {notice}
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
          <Label className="flex-col items-stretch gap-1.5">
            Nome do contrato
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus={!initial.title} placeholder="Ex.: Contrato padrão de serviços" />
          </Label>
          <Label className="flex-col items-stretch gap-1.5">
            Aplicação
            <NativeSelect value={kind} onChange={(event) => setKind(event.target.value as Contract['kind'])}>
              <NativeSelectOption value="standard">Padrão (todo acompanhamento)</NativeSelectOption>
              <NativeSelectOption value="procedure">Específico de procedimento</NativeSelectOption>
              <NativeSelectOption value="combo">Específico de combo</NativeSelectOption>
            </NativeSelect>
          </Label>
          {kind === 'procedure' && (
            <Label className="flex-col items-stretch gap-1.5 sm:col-span-2">
              Procedimento
              <NativeSelect value={procedureId} onChange={(event) => setProcedureId(event.target.value)}>
                <NativeSelectOption value="">Selecione…</NativeSelectOption>
                {procedures.map((procedure) => <NativeSelectOption key={procedure.id} value={procedure.id}>{procedure.name}</NativeSelectOption>)}
              </NativeSelect>
            </Label>
          )}
          {kind === 'combo' && (
            <Label className="flex-col items-stretch gap-1.5 sm:col-span-2">
              Combo
              <NativeSelect value={comboId} onChange={(event) => setComboId(event.target.value)}>
                <NativeSelectOption value="">Selecione…</NativeSelectOption>
                {combos.map((combo) => <NativeSelectOption key={combo.id} value={combo.id}>{combo.name}</NativeSelectOption>)}
              </NativeSelect>
            </Label>
          )}
        </div>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="panel grid gap-3">
          <h3 className="m-0 text-base font-semibold">Texto do contrato</h3>
          <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={22} aria-label="Texto do contrato" placeholder="Escreva o conteúdo do contrato. Importação de DOCX fica disponível ao configurar o armazenamento R2." />
        </section>
        <section className="panel grid gap-3" aria-label="Prévia do contrato">
          <h3 className="m-0 text-base font-semibold">Prévia do documento</h3>
          <article className="min-h-64 rounded-md border bg-background p-6 shadow-sm">
            <h4 className="mb-4 mt-0 text-center text-base font-semibold">{title || 'Nome do contrato'}</h4>
            {content.trim() ? <p className="m-0 whitespace-pre-wrap text-sm leading-relaxed">{content}</p> : <p className="m-0 text-sm text-muted-foreground">O texto aparece aqui enquanto você escreve.</p>}
          </article>
        </section>
      </div>
    </form>
  );
}
