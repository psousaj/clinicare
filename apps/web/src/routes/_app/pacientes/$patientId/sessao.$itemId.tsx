import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { QueryError } from '@/components/QueryState';
import { SchemaForm } from '@/components/SchemaForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { followupsQuery, useCreateSession } from '@/lib/queries';

export const Route = createFileRoute('/_app/pacientes/$patientId/sessao/$itemId')({ component: NewSession });

function NewSession() {
  const { patientId, itemId } = Route.useParams();
  const navigate = useNavigate();
  const followups = useQuery(followupsQuery);
  const create = useCreateSession();
  const [data, setData] = useState<Record<string, unknown>>({});
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState('');
  const followup = (followups.data ?? []).find((candidate) => candidate.items.some((entry) => entry.id === itemId));
  const item = followup?.items.find((candidate) => candidate.id === itemId);

  return (
    <section className="panel grid gap-4">
      <div className="panel-header">
        <div>
          <Link to="/pacientes/$patientId" params={{ patientId }} className="text-button mb-2"><ArrowLeft size={14} /> Paciente</Link>
          <h2>Registrar atendimento realizado</h2>
          {item && <p className="section-note m-0">{item.procedureName} · depois de salvar você poderá anexar fotos e acompanhar o atendimento.</p>}
        </div>
      </div>
      <QueryError query={followups} />
      {followups.isSuccess && !item && <p className="section-note" role="alert">Procedimento contratado não encontrado.</p>}
      {item && (
        <div className="max-w-2xl">
          <SchemaForm
            schema={(item.sessionSchema ?? { type: 'object', properties: {} }) as Record<string, unknown>}
            value={data}
            onChange={setData}
            onSubmit={(answers) => create.mutateAsync({ followupId: followup!.id, followupItemId: item.id, appointmentId: null, durationMinutes: duration ? Number(duration) : null, data: answers, notes: notes.trim() || null }).then((created) => navigate({ to: '/pacientes/$patientId/sessoes/$sessionId', params: { patientId, sessionId: created.id } }), () => undefined)}
            actions={(
              <div className="mt-4 grid gap-4">
                <Label className="flex-col items-stretch gap-1.5">
                  Duração (minutos)
                  <Input type="number" min={1} max={1440} step={1} value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="Ex.: 60" className="max-w-40" />
                </Label>
                <Label className="flex-col items-stretch gap-1.5">
                  Observações
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
                </Label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" asChild><Link to="/pacientes/$patientId" params={{ patientId }}>Cancelar</Link></Button>
                  <Button type="submit" disabled={create.isPending}>Salvar atendimento</Button>
                </div>
              </div>
            )}
          />
        </div>
      )}
    </section>
  );
}
