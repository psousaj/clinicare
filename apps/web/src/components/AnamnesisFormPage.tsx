import { Link } from '@tanstack/react-router';
import { ArrowLeft, Eye } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { SchemaEditor } from '@/components/SchemaEditor';
import { SchemaForm } from '@/components/SchemaForm';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const [previewOpen, setPreviewOpen] = useState(false);

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
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}><Eye /> Pré-visualizar</Button>
            <Button type="button" variant="outline" asChild><Link to="/formularios-anamnese">Cancelar</Link></Button>
            <Button type="submit" disabled={saving}>{submitLabel}</Button>
          </div>
        </div>
        {notice}
        <Label className="flex-col items-stretch gap-1.5">
          Nome do formulário
          <Input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus={!initialTitle} placeholder="Ex.: Anamnese facial" />
        </Label>
        <Label className="flex-col items-stretch gap-1.5">
          Descrição para o paciente <span className="text-xs font-normal text-muted-foreground">Explique para que serve esta anamnese e o que o paciente deve considerar.</span>
          <textarea className="min-h-24 rounded-lg border border-input bg-transparent px-3 py-2 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Vamos conhecer seu histórico de saúde para preparar seu atendimento com segurança." />
        </Label>
        <Label className="flex-col items-stretch gap-1.5">
          Validade (meses)
          <Input type="number" min="1" value={validity} onChange={(event) => setValidity(event.target.value)} aria-describedby="validity-hint" />
          <span id="validity-hint" className="text-xs font-normal text-muted-foreground">Enquanto válida, não é pedida de novo ao paciente. O vínculo com procedimentos, combos, planos e eventos é feito na edição de cada oferta.</span>
        </Label>
      </section>
      <SchemaEditor value={schema} onChange={setSchema} />
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização</DialogTitle>
            <DialogDescription>Como o paciente verá este formulário no link dele. Nada é salvo aqui.</DialogDescription>
          </DialogHeader>
          <PatientPreview title={title} description={description} schema={schema} onClose={() => setPreviewOpen(false)} />
        </DialogContent>
      </Dialog>
    </form>
  );
}

// Espelha o link público do paciente (formulario.$token.tsx): mesmo card,
// cabeçalho, texto de ajuda, descrição e campos — só que sem salvar nada.
function PatientPreview({ title, description, schema, onClose }: { title: string; description: string; schema: Record<string, unknown>; onClose: () => void }) {
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  return (
    <section className="public-form-card">
      <div className="section-kicker">SOLICITAÇÃO DE ANAMNESE</div>
      <h1>{title.trim() || 'Formulário sem nome'}</h1>
      <p>Este formulário ajuda a equipe da clínica a conhecer seu histórico e preparar seu atendimento com segurança. Responda com atenção; ao enviar, suas respostas ficam registradas de forma privada para a equipe responsável.</p>
      {description.trim() && <p className="public-form-description">{description.trim()}</p>}
      <SchemaForm
        schema={schema}
        value={draft}
        onChange={setDraft}
        actions={(
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>Fechar</Button>
          </div>
        )}
      />
    </section>
  );
}
