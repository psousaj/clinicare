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
  initialSchema?: Record<string, unknown>;
  notice?: ReactNode;
  actions?: ReactNode;
  saving?: boolean;
  onSave: (data: { title: string; schema: Record<string, unknown> }) => Promise<unknown>;
};

const emptySchema: Record<string, unknown> = { type: 'object', properties: {} };

// Página de cadastro/edição de formulário de anamnese: nome no topo, campos e prévia utilizável abaixo.
export function AnamnesisFormPage({ heading, submitLabel, initialTitle = '', initialSchema = emptySchema, notice, actions, saving, onSave }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [schema, setSchema] = useState(initialSchema);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (title.trim().length < 2) throw new Error('Informe o nome do formulário.');
      const problem = validateFormSchema(schema);
      if (problem) throw new Error(problem);
      await onSave({ title: title.trim(), schema });
    } catch (error) {
      if (!(error instanceof ApiError)) toast.error((error as Error).message);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <section className="panel grid gap-4">
        <div className="panel-header">
          <div>
            <Link to="/formularios-anamnese" className="text-button mb-2"><ArrowLeft size={14} /> Formulários de anamnese</Link>
            <h2>{heading}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {actions}
            <Button type="button" variant="outline" asChild><Link to="/formularios-anamnese">Cancelar</Link></Button>
            <Button type="submit" disabled={saving}>{submitLabel}</Button>
          </div>
        </div>
        {notice}
        <Label className="max-w-xl flex-col items-stretch gap-1.5">
          Nome do formulário
          <Input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus={!initialTitle} placeholder="Ex.: Anamnese facial" />
        </Label>
      </section>
      <SchemaEditor value={schema} onChange={setSchema} />
    </form>
  );
}
