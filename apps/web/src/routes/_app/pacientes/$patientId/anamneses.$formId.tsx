import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { QueryError } from '@/components/QueryState';
import { SchemaForm } from '@/components/SchemaForm';
import { Button } from '@/components/ui/button';
import { attendancesQuery, patientsQuery, useAnswerAnamnesis } from '@/lib/queries';

export const Route = createFileRoute('/_app/pacientes/$patientId/anamneses/$formId')({ component: FillAnamnesis });

function FillAnamnesis() {
  const { patientId, formId } = Route.useParams();
  const navigate = useNavigate();
  const attendances = useQuery(attendancesQuery), patients = useQuery(patientsQuery);
  const answer = useAnswerAnamnesis();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const form = (attendances.data ?? []).flatMap((attendance) => attendance.anamneses).find((candidate) => candidate.id === formId);
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
          <h2>{form ? form.title : 'Anamnese'}</h2>
          <p className="section-note m-0">Preenchimento na clínica{patient ? ` · ${patient.fullName}` : ''}</p>
        </div>
      </div>
      <QueryError query={attendances} />
      {attendances.isSuccess && !form && <p className="section-note" role="alert">Anamnese não encontrada.</p>}
      {form?.answered && <p className="section-note" role="status">Esta anamnese já foi respondida.</p>}
      {form && !form.answered && form.schemaSnapshot && (
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
