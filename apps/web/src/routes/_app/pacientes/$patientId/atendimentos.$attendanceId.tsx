import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { QueryError } from '@/components/QueryState';
import { SchemaForm } from '@/components/SchemaForm';
import { AttendancePhotos } from '@/components/AttendancePhotos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { dateTime } from '@/lib/format';
import { patientsQuery, attendanceQuery, useUpdateAttendance } from '@/lib/queries';
import type { Attendance } from '@/lib/schemas';

export const Route = createFileRoute('/_app/pacientes/$patientId/atendimentos/$attendanceId')({ component: AttendanceFollowUp });

function AttendanceFollowUp() {
  const { patientId, attendanceId } = Route.useParams();
  const attendance = useQuery(attendanceQuery(attendanceId)), patients = useQuery(patientsQuery);
  const patient = patients.data?.find((candidate) => candidate.id === patientId);
  return (
    <div className="grid gap-4">
      <section className="panel">
        <div className="panel-header">
          <div>
            <Link to="/pacientes/$patientId" params={{ patientId }} className="text-button mb-2"><ArrowLeft size={14} /> {patient?.fullName ?? 'Paciente'}</Link>
            <h2>Detalhes do atendimento</h2>
            {attendance.data && <p className="section-note m-0">{attendance.data.procedureName} · {dateTime(attendance.data.performedAt)}</p>}
          </div>
        </div>
        <QueryError query={attendance} />
        {attendance.isPending && <p className="section-note">Carregando…</p>}
      </section>
      {attendance.data && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Record attendance={attendance.data} />
          <AttendancePhotos attendanceId={attendance.data.id} photos={attendance.data.photos} />
        </div>
      )}
    </div>
  );
}

function Record({ attendance }: { attendance: Attendance }) {
  const update = useUpdateAttendance(attendance.id);
  const [data, setData] = useState<Record<string, unknown>>(attendance.data ?? {});
  const [notes, setNotes] = useState(attendance.notes ?? '');
  const [duration, setDuration] = useState(attendance.durationMinutes ? String(attendance.durationMinutes) : '');
  return (
    <section className="panel grid gap-4">
      <div className="panel-header"><div><div className="section-kicker">REGISTRO</div><h2>Observações e dados</h2></div></div>
      <SchemaForm
        schema={(attendance.schemaSnapshot ?? { type: 'object', properties: {} }) as Record<string, unknown>}
        value={data}
        onChange={setData}
        onSubmit={(answers) => update.mutate({ data: answers, notes: notes.trim() || null, durationMinutes: duration ? Number(duration) : null })}
        actions={(
          <div className="mt-4 grid gap-4">
            {attendance.appointmentId && <Label className="flex-col items-stretch gap-1.5">
              Duração (minutos)
              <Input type="number" min={1} max={1440} step={1} value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Ex.: 60" className="max-w-40" />
            </Label>}
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
