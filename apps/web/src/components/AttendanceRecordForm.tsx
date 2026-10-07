import { Link, useNavigate } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { SchemaForm } from '@/components/SchemaForm';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateAttendance } from '@/lib/queries';

// Formulário de registro de um atendimento realizado (procedimento de um acompanhamento ou avulso).
export function AttendanceRecordForm({ patientId, procedureName, schema, target }: { patientId: string; procedureName: string; schema: Record<string, unknown>; target: Record<string, unknown> }): ReactNode {
  const navigate = useNavigate();
  const create = useCreateAttendance();
  const [data, setData] = useState<Record<string, unknown>>({});
  const [notes, setNotes] = useState('');
  return (
    <div className="max-w-2xl">
      <p className="section-note mt-0">{procedureName} · depois de salvar você poderá anexar fotos e acompanhar o atendimento.</p>
      <SchemaForm
        schema={schema}
        value={data}
        onChange={setData}
        onSubmit={(answers) => create.mutateAsync({ ...target, patientId, appointmentId: null, data: answers, notes: notes.trim() || null }).then((created) => navigate({ to: '/pacientes/$patientId/atendimentos/$attendanceId', params: { patientId, attendanceId: created.id } }), () => undefined)}
        actions={(
          <div className="mt-4 grid gap-4">
            <p className="m-0 text-sm text-muted-foreground">Este registro baixa uma sessão do acompanhamento. A duração fica definida pelo procedimento ou pelo agendamento.</p>
            <Label className="flex-col items-stretch gap-1.5">
              Observações
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </Label>
            <div className="form-page-actions">
              <Button type="button" variant="outline" asChild><Link to="/pacientes/$patientId" params={{ patientId }}>Cancelar</Link></Button>
              <Button type="submit" disabled={create.isPending}>Salvar atendimento</Button>
            </div>
          </div>
        )}
      />
    </div>
  );
}
