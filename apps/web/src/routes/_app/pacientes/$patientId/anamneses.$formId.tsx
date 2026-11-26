import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, useMatch, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, BookOpenText } from 'lucide-react';
import { useState } from 'react';
import { QueryError } from '@/components/QueryState';
import { SchemaForm } from '@/components/SchemaForm';
import { Button } from '@/components/ui/button';
import { patientHistoryQuery, patientsQuery, useAnswerAnamnesis } from '@/lib/queries';

export const Route = createFileRoute('/_app/pacientes/$patientId/anamneses/$formId')({ component: FillAnamnesis });

function FillAnamnesis() {
  const { patientId, formId } = Route.useParams();
  const navigate = useNavigate();
  const history = useQuery(patientHistoryQuery(patientId)), patients = useQuery(patientsQuery);
  const answer = useAnswerAnamnesis();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  // A página de respostas é rota filha: quando ativa, o pai só cede o lugar.
  const respostasActive = !!useMatch({ from: '/_app/pacientes/$patientId/anamneses/$formId/respostas', shouldThrow: false });
  if (respostasActive) return <Outlet />;
  const form = history.data?.events.find((event) => event.type === 'anamnesis' && event.details?.id === formId)?.details as {
    id: string; title?: string; titleSnapshot?: string; schemaSnapshot?: Record<string, unknown>; submittedAt?: string | null;
  } | undefined;
  const patient = patients.data?.find((candidate) => candidate.id === patientId);
  async function submit(value: Record<string, unknown>) {
    await answer.mutateAsync({ id: formId, answers: value });
    await navigate({ to: '/pacientes/$patientId', params: { patientId } });
  }

  return (
    <section className="panel grid gap-4">
      <div className="panel-header">
        <div>
          <Link to="/pacientes/$patientId" params={{ patientId }} className="text-button mb-2"><ArrowLeft size={14} /> {patient?.fullName ?? 'Paciente'}</Link>
          <h2>{form ? form.titleSnapshot ?? form.title : 'Anamnese'}</h2>
          <p className="section-note m-0">Preenchimento na clínica{patient ? ` · ${patient.fullName}` : ''}</p>
        </div>
      </div>
      <QueryError query={history} />
      {history.isSuccess && !form && <p className="section-note" role="alert">Anamnese não encontrada.</p>}
      {form?.submittedAt && (
        <div className="grid gap-2">
          <p className="section-note m-0" role="status">Esta anamnese já foi respondida.</p>
          <div>
            <Button size="sm" asChild>
              <Link to="/pacientes/$patientId/anamneses/$formId/respostas" params={{ patientId, formId: form.id }}>
                <BookOpenText /> Ver respostas
              </Link>
            </Button>
          </div>
        </div>
      )}
      {form && !form.submittedAt && form.schemaSnapshot && (
        <SchemaForm
          schema={form.schemaSnapshot}
          value={answers}
          onChange={setAnswers}
          onSubmit={(value) => submit(value).catch(() => undefined)}
          actions={<div className="mt-4"><Button type="submit" disabled={answer.isPending}>Salvar respostas</Button></div>}
        />
      )}
    </section>
  );
}
