import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { QueryError } from '@/components/QueryState';
import { SchemaForm } from '@/components/SchemaForm';
import { dateTime } from '@/lib/format';
import { appliedAnamnesisQuery, patientsQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/pacientes/$patientId/anamneses/$formId/respostas')({ component: AnamnesisAnswers });

// Leitura das respostas de uma anamnese já enviada (mesmo formulário, travado).
function AnamnesisAnswers() {
  const { patientId, formId } = Route.useParams();
  const detail = useQuery(appliedAnamnesisQuery(formId));
  const patients = useQuery(patientsQuery);
  const patient = patients.data?.find((candidate) => candidate.id === patientId);
  const title = detail.data?.title ?? detail.data?.titleSnapshot ?? 'Anamnese';

  return (
    <section className="panel grid gap-4">
      <div className="panel-header">
        <div>
          <Link to="/pacientes/$patientId" params={{ patientId }} className="text-button mb-2"><ArrowLeft size={14} /> {patient?.fullName ?? 'Paciente'}</Link>
          <div className="section-kicker">RESPOSTAS ENVIADAS</div>
          <h2>{title}</h2>
          {detail.data?.submittedAt && <p className="section-note m-0">Respondida em {dateTime(detail.data.submittedAt)}</p>}
        </div>
      </div>
      <QueryError query={detail} />
      {detail.isPending && <p className="section-note">Carregando respostas…</p>}
      {detail.data?.schemaSnapshot && (
        <SchemaForm schema={detail.data.schemaSnapshot} value={detail.data.answers ?? {}} onChange={() => undefined} readOnly />
      )}
    </section>
  );
}
