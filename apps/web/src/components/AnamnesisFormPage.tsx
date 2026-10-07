import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { SchemaEditor } from '@/components/SchemaEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { validateFormSchema } from '@/lib/fieldKinds';

type Props = {
  heading: string;
  submitLabel: string;
  initialTitle?: string;
  initialDescription?: string | null;
  initialSchema?: Record<string, unknown>;
  initialValidityMonths?: number;
  notice?: ReactNode;
  actions?: ReactNode;
  saving?: boolean;
  onSave: (data: { title: string; description: string | null; schema: Record<string, unknown>; validityMonths: number }) => Promise<unknown>;
};

const emptySchema: Record<string, unknown> = { type: 'object', properties: {} };

// Página de cadastro/edição de formulário de anamnese: nome no topo, campos e prévia utilizável abaixo.
export function AnamnesisFormPage({ heading, submitLabel, initialTitle = '', initialDescription = '', initialSchema = emptySchema, initialValidityMonths = 12, notice, actions, saving, onSave }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [schema, setSchema] = useState(initialSchema);
  const [validity, setValidity] = useState(String(initialValidityMonths));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (title.trim().length < 2) throw new Error('Informe o nome do formulário.');
      const problem = validateFormSchema(schema);
      if (problem) throw new Error(problem);
      const validityMonths = Number(validity);
      if (!Number.isInteger(validityMonths) || validityMonths < 1) throw new Error('Informe a validade em meses (mínimo 1).');
      await onSave({ title: title.trim(), description: description.trim() || null, schema, validityMonths });
    } catch (error) {
      if (!(error instanceof ApiError)) toast.error((error as Error).message);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <section className="panel grid gap-4">
        <div className="panel-header form-page-header">
          <div>
            <Link to="/formularios-anamnese" className="text-button mb-2"><ArrowLeft size={14} /> Formulários de anamnese</Link>
            <h2>{heading}</h2>
          </div>
          <div className="form-page-actions">
            {actions && <div className="form-page-extra-actions">{actions}</div>}
            <Button type="button" variant="outline" asChild><Link to="/formularios-anamnese">Cancelar</Link></Button>
            <Button type="submit" disabled={saving}>{submitLabel}</Button>
          </div>
        </div>
        {notice}
        <Label className="max-w-xl flex-col items-stretch gap-1.5">
          Nome do formulário
          <Input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus={!initialTitle} placeholder="Ex.: Anamnese facial" />
        </Label>
        <Label className="max-w-2xl flex-col items-stretch gap-1.5">
          Descrição para o paciente <span className="text-xs font-normal text-muted-foreground">Explique para que serve esta anamnese e o que o paciente deve considerar.</span>
          <textarea className="min-h-24 rounded-lg border border-input bg-transparent px-3 py-2 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Vamos conhecer seu histórico de saúde para preparar seu atendimento com segurança." />
        </Label>
        <Label className="max-w-3xl flex-col items-stretch gap-1.5">
          Validade (meses)
          <Input className="max-w-52" type="number" min="1" value={validity} onChange={(event) => setValidity(event.target.value)} aria-describedby="validity-hint" />
          <span id="validity-hint" className="text-xs font-normal text-muted-foreground">Enquanto válida, não é pedida de novo ao paciente. O vínculo com procedimentos, combos, planos e eventos é feito na edição de cada oferta.</span>
        </Label>
      </section>
      <SchemaEditor value={schema} onChange={setSchema} />
    </form>
  );
}
