import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useCreateAppliedAnamnesis, anamnesesQuery, proceduresQuery } from '@/lib/queries';
import { Button } from '@/components/ui/button';

type Applied = {
  id: string;
  procedureId: string;
  title: string;
  submittedAt: string | null;
  validUntil: string | null;
};

export function StandaloneAnamnesisPanel({ patientId, applied }: { patientId: string; applied: Applied[] }) {
  const forms = useQuery(anamnesesQuery), procedures = useQuery(proceduresQuery);
  const create = useCreateAppliedAnamnesis(patientId);
  const [procedureId, setProcedureId] = useState('');
  const [anamnesisId, setAnamnesisId] = useState('');
  const linkedForms = forms.data?.filter((form) => form.active !== false && form.procedureIds?.includes(procedureId)) ?? [];

  return (
    <section className="panel grid gap-3" aria-label="Anamneses de atendimentos avulsos">
      <div className="panel-header"><div><div className="section-kicker">ATENDIMENTO AVULSO</div><h2>Anamneses</h2></div></div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="grid gap-1 text-sm">Procedimento
          <select className="h-10 rounded-md border border-input bg-background px-3" value={procedureId} onChange={(event) => { setProcedureId(event.target.value); setAnamnesisId(''); }}>
            <option value="">Escolha um procedimento</option>
            {(procedures.data ?? []).map((procedure) => <option key={procedure.id} value={procedure.id}>{procedure.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Formulário
          <select className="h-10 rounded-md border border-input bg-background px-3" value={anamnesisId} onChange={(event) => setAnamnesisId(event.target.value)} disabled={!procedureId}>
            <option value="">Escolha uma anamnese vinculada</option>
            {linkedForms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}
          </select>
        </label>
        <Button className="self-end" disabled={!procedureId || !anamnesisId || create.isPending} onClick={() => create.mutate({ patientId, procedureId, anamnesisId })}>Aplicar anamnese</Button>
      </div>
      {applied.map((form) => (
        <div className="procedure-row" key={form.id}>
          <span className="procedure-info"><strong>{form.title}</strong><small>{procedures.data?.find((procedure) => procedure.id === form.procedureId)?.name ?? 'Procedimento avulso'} · {form.submittedAt ? 'respondida' : 'pendente'}</small></span>
          <Button size="sm" variant="outline" asChild>
            <Link to={form.submittedAt ? '/pacientes/$patientId/anamneses/$formId/respostas' : '/pacientes/$patientId/anamneses/$formId'} params={{ patientId, formId: form.id }}>
              {form.submittedAt ? 'Ver respostas' : 'Preencher na clínica'}
            </Link>
          </Button>
        </div>
      ))}
    </section>
  );
}
