import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { QueryError } from '@/components/QueryState';
import { SchemaForm } from '@/components/SchemaForm';
import { SessionPhotos } from '@/components/SessionPhotos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { dateTime } from '@/lib/format';
import { patientsQuery, sessionQuery, useUpdateSession } from '@/lib/queries';
import type { Session } from '@/lib/schemas';

export const Route = createFileRoute('/_app/pacientes/$patientId/sessoes/$sessionId')({ component: SessionFollowUp });

function SessionFollowUp() {
  const { patientId, sessionId } = Route.useParams();
  const session = useQuery(sessionQuery(sessionId)), patients = useQuery(patientsQuery);
  const patient = patients.data?.find((candidate) => candidate.id === patientId);
  return (
    <div className="grid gap-4">
      <section className="panel">
        <div className="panel-header">
          <div>
            <Link to="/pacientes/$patientId" params={{ patientId }} className="text-button mb-2"><ArrowLeft size={14} /> {patient?.fullName ?? 'Paciente'}</Link>
            <h2>Detalhes do atendimento</h2>
            {session.data && <p className="section-note m-0">{session.data.procedureName} · {dateTime(session.data.performedAt)}</p>}
          </div>
        </div>
        <QueryError query={session} />
        {session.isPending && <p className="section-note">Carregando…</p>}
      </section>
      {session.data && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Record session={session.data} />
          <SessionPhotos sessionId={session.data.id} photos={session.data.photos} />
        </div>
      )}
    </div>
  );
}

function Record({ session }: { session: Session }) {
  const update = useUpdateSession(session.id);
  const [data, setData] = useState<Record<string, unknown>>(session.data ?? {});
  const [notes, setNotes] = useState(session.notes ?? '');
  const [duration, setDuration] = useState(session.durationMinutes ? String(session.durationMinutes) : '');
  return (
    <section className="panel grid gap-4">
      <div className="panel-header"><div><div className="section-kicker">REGISTRO</div><h2>Observações e dados</h2></div></div>
      <SchemaForm
        schema={(session.schemaSnapshot ?? { type: 'object', properties: {} }) as Record<string, unknown>}
        value={data}
        onChange={setData}
        onSubmit={(answers) => update.mutate({ data: answers, notes: notes.trim() || null, durationMinutes: duration ? Number(duration) : null })}
        actions={(
          <div className="mt-4 grid gap-4">
            <Label className="flex-col items-stretch gap-1.5">
              Duração (minutos)
              <Input type="number" min={1} max={1440} step={1} value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Ex.: 60" className="max-w-40" />
            </Label>
            <Label className="flex-col items-stretch gap-1.5">
              Observações do atendimento
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} placeholder="Evolução, reações, orientações ao paciente…" />
            </Label>
            <div><Button type="submit" disabled={update.isPending}>Salvar atendimento</Button></div>
          </div>
        )}
      />
    </section>
  );
}
