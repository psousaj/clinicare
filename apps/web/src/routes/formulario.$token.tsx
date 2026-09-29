import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { SchemaForm } from '@/components/SchemaForm';
import { Button } from '@/components/ui/button';
import { publicFormQuery, useSaveDraft, useSubmitAnamnesis } from '@/lib/queries';

export const Route = createFileRoute('/formulario/$token')({ component: PublicAnamnesis });

function PublicAnamnesis() {
  const { token } = Route.useParams();
  const form = useQuery(publicFormQuery(token));
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      {form.isPending && <p className="section-note">Carregando formulário…</p>}
      {form.isError && <p className="section-note" role="alert">{form.error.message}</p>}
      {form.data && <AnamnesisForm token={token} title={form.data.title} schema={form.data.schema} initialDraft={form.data.draft} />}
    </div>
  );
}

function AnamnesisForm({ token, title, schema, initialDraft }: { token: string; title: string; schema: Record<string, unknown>; initialDraft: Record<string, unknown> }) {
  const [draft, setDraft] = useState(initialDraft), [submitted, setSubmitted] = useState(false);
  const saveDraft = useSaveDraft(token), submit = useSubmitAnamnesis(token);

  async function send(answers: Record<string, unknown>) {
    await submit.mutateAsync(answers);
    setSubmitted(true);
  }

  if (submitted) return <section className="public-form-card"><h1>Anamnese enviada. Obrigado!</h1><p>Suas respostas foram registradas pela clínica.</p></section>;
  return (
    <section className="public-form-card">
      <div className="section-kicker">FORMULÁRIO DA CLÍNICA</div>
      <h1>{title}</h1>
      <p>Preencha com atenção. Ao enviar, suas respostas ficam registradas.</p>
      <SchemaForm
        schema={schema}
        value={draft}
        onChange={setDraft}
        onSubmit={(answers) => send(answers).catch(() => undefined)}
        actions={(
          <div className="modal-actions">
            <Button type="button" variant="outline" disabled={saveDraft.isPending} onClick={() => saveDraft.mutate(draft)}>Salvar rascunho</Button>
            <Button type="submit" disabled={submit.isPending}>Enviar anamnese</Button>
          </div>
        )}
      />
    </section>
  );
}
