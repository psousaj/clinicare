import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { QueryError } from '@/components/QueryState';
import { AttendanceRecordForm } from '@/components/AttendanceRecordForm';
import { followupsQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/pacientes/$patientId/novo-atendimento/$itemId')({ component: NewAttendance });

function NewAttendance() {
  const { patientId, itemId } = Route.useParams();
  const followups = useQuery(followupsQuery);
  const followup = (followups.data ?? []).find((candidate) => candidate.items.some((entry) => entry.id === itemId));
  const item = followup?.items.find((candidate) => candidate.id === itemId);

  return (
    <section className="panel grid gap-4">
      <div className="panel-header">
        <div>
          <Link to="/pacientes/$patientId" params={{ patientId }} className="text-button mb-2"><ArrowLeft size={14} /> Paciente</Link>
          <h2>Registrar atendimento realizado</h2>
        </div>
      </div>
      <QueryError query={followups} />
      {followups.isSuccess && !item && <p className="section-note" role="alert">Procedimento contratado não encontrado.</p>}
      {item && <AttendanceRecordForm patientId={patientId} procedureName={item.procedureName} schema={(item.sessionSchema ?? { type: 'object', properties: {} }) as Record<string, unknown>} target={{ followupId: followup!.id, followupItemId: item.id }} />}
    </section>
  );
}
