import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ProcedureFormPage } from '@/components/ProcedureForm';
import { QueryError } from '@/components/QueryState';
import { proceduresQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/procedimentos/$procedureId')({ component: EditProcedure });

function EditProcedure() {
  const { procedureId } = Route.useParams();
  const procedures = useQuery(proceduresQuery);
  const procedure = procedures.data?.find((candidate) => candidate.id === procedureId);
  if (procedure) return <ProcedureFormPage key={procedure.id} procedure={procedure} />;
  return (
    <section className="panel">
      <QueryError query={procedures} />
      {procedures.isPending && <p className="section-note">Carregando…</p>}
      {procedures.isSuccess && <p className="section-note" role="alert">Procedimento não encontrado.</p>}
    </section>
  );
}
