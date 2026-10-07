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
      {form.data && <AnamnesisForm token={token} title={form.data.title} description={form.data.description ?? null} schema={form.data.schema} initialDraft={form.data.draft} branding={form.data.branding ?? { clinicName: 'Clínica', professionalName: null, professionalRegistration: null }} />}
    </div>
  );
}

function AnamnesisForm({ token, title, description, schema, initialDraft, branding }: { token: string; title: string; description: string | null; schema: Record<string, unknown>; initialDraft: Record<string, unknown>; branding: { clinicName: string; professionalName: string | null; professionalRegistration: string | null } }) {
  const [draft, setDraft] = useState(initialDraft), [submitted, setSubmitted] = useState(false);
  const saveDraft = useSaveDraft(token), submit = useSubmitAnamnesis(token);

  async function send(answers: Record<string, unknown>) {
    await submit.mutateAsync(answers);
    setSubmitted(true);
  }

  if (submitted) return <section className="public-form-card"><PublicIdentity branding={branding} /><h1>Anamnese enviada. Obrigado!</h1><p>Suas respostas foram registradas pela clínica.</p></section>;
  return (
    <section className="public-form-card">
      <PublicIdentity branding={branding} />
      <div className="section-kicker">SOLICITAÇÃO DE ANAMNESE</div>
      <h1>{title}</h1>
      <p>Este formulário ajuda a equipe da clínica a conhecer seu histórico e preparar seu atendimento com segurança. Responda com atenção; ao enviar, suas respostas ficam registradas de forma privada para a equipe responsável.</p>
      {description && <p className="public-form-description">{description}</p>}
      <SchemaForm
        schema={schema}
        value={draft}
        onChange={setDraft}
        onSubmit={(answers) => send(answers).catch(() => undefined)}
        actions={(
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={saveDraft.isPending} onClick={() => saveDraft.mutate(draft)}>Salvar rascunho</Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={submit.isPending}>Enviar anamnese</Button>
          </div>
        )}
      />
    </section>
  );
}

function PublicIdentity({ branding }: { branding: { clinicName: string; professionalName: string | null; professionalRegistration: string | null } }) {
  return <header className="public-clinic-identity">
    <div className="public-clinic-mark" aria-hidden="true">{branding.clinicName.slice(0, 1).toUpperCase()}</div>
    <div><strong>{branding.clinicName}</strong><span>{branding.professionalName ?? 'Equipe responsável pelo atendimento'}{branding.professionalRegistration ? ` · ${branding.professionalRegistration}` : ''}</span></div>
  </header>;
}
