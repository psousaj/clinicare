import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { SchemaEditor } from '@/components/SchemaEditor';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { validateFormSchema } from '@/lib/fieldKinds';
import { proceduresQuery } from '@/lib/queries';

type Props = {
  heading: string;
  submitLabel: string;
  initialTitle?: string;
  initialSchema?: Record<string, unknown>;
  initialValidityMonths?: number;
  initialProcedureIds?: string[];
  notice?: ReactNode;
  actions?: ReactNode;
  saving?: boolean;
  onSave: (data: { title: string; schema: Record<string, unknown>; validityMonths: number; procedureIds: string[] }) => Promise<unknown>;
};

const emptySchema: Record<string, unknown> = { type: 'object', properties: {} };

// Página de cadastro/edição de formulário de anamnese: nome no topo, campos e prévia utilizável abaixo.
export function AnamnesisFormPage({ heading, submitLabel, initialTitle = '', initialSchema = emptySchema, initialValidityMonths = 12, initialProcedureIds = [], notice, actions, saving, onSave }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [schema, setSchema] = useState(initialSchema);
  const [validity, setValidity] = useState(String(initialValidityMonths));
  const [procedureIds, setProcedureIds] = useState(initialProcedureIds);
  const procedures = useQuery(proceduresQuery).data ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (title.trim().length < 2) throw new Error('Informe o nome do formulário.');
      const problem = validateFormSchema(schema);
      if (problem) throw new Error(problem);
      const validityMonths = Number(validity);
      if (!Number.isInteger(validityMonths) || validityMonths < 1) throw new Error('Informe a validade em meses (mínimo 1).');
      await onSave({ title: title.trim(), schema, validityMonths, procedureIds });
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
        <div className="grid max-w-3xl gap-4 sm:grid-cols-[12rem_1fr]">
          <Label className="flex-col items-stretch gap-1.5">
            Validade (meses)
            <Input type="number" min="1" value={validity} onChange={(event) => setValidity(event.target.value)} aria-describedby="validity-hint" />
            <span id="validity-hint" className="text-xs font-normal text-muted-foreground">Enquanto válida, não é pedida de novo ao paciente.</span>
          </Label>
          <div role="group" aria-label="Procedimentos que exigem este formulário" className="grid content-start gap-2">
            <span className="text-sm font-medium">Exigido nos procedimentos</span>
            {procedures.length === 0 && <span className="text-xs text-muted-foreground">Nenhum procedimento cadastrado.</span>}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {procedures.map((procedure) => (
                <Label key={procedure.id} className="cursor-pointer">
                  <Checkbox checked={procedureIds.includes(procedure.id)} onCheckedChange={(value) => setProcedureIds((current) => (value === true ? [...current, procedure.id] : current.filter((id) => id !== procedure.id)))} />
                  {procedure.name}
                </Label>
              ))}
            </div>
          </div>
        </div>
      </section>
      <SchemaEditor value={schema} onChange={setSchema} />
    </form>
  );
}
