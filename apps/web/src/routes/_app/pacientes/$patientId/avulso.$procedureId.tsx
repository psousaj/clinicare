import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { QueryError } from '@/components/QueryState';
import { AttendanceRecordForm } from '@/components/AttendanceRecordForm';
import { proceduresQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/pacientes/$patientId/avulso/$procedureId')({ component: NewStandaloneAttendance });

function NewStandaloneAttendance() {
  const { patientId, procedureId } = Route.useParams();
  const procedures = useQuery(proceduresQuery);
  const procedure = procedures.data?.find((candidate) => candidate.id === procedureId && candidate.active !== false && candidate.standalone !== false);
  return (
    <section className="panel grid gap-4">
      <div className="panel-header">
        <div>
          <Link to="/pacientes/$patientId" params={{ patientId }} className="text-button mb-2"><ArrowLeft size={14} /> Paciente</Link>
          <h2>Registrar atendimento avulso</h2>
        </div>
      </div>
      <QueryError query={procedures} />
      {procedures.isSuccess && !procedure && <p className="section-note" role="alert">Procedimento avulso não encontrado.</p>}
      {procedure && <AttendanceRecordForm patientId={patientId} procedureName={procedure.name} schema={(procedure.sessionSchema ?? { type: 'object', properties: {} }) as Record<string, unknown>} target={{ patientId, procedureId: procedure.id }} />}
    </section>
  );
}
