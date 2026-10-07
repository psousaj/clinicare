import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FileSignature, Hourglass } from 'lucide-react';
import { useState } from 'react';
import { ProfessionalSignDialog, type ProfessionalSignItem } from '@/components/ProfessionalSignDialog';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { signaturePendingQuery } from '@/lib/queries';

// Documentos: fila de assinaturas do lado da clínica. O representante assina
// aqui (prévia + confirmação autenticadas); o paciente assina pelo link
// público copiado no histórico do contrato.
export const Route = createFileRoute('/_app/documentos')({ component: Documents });

function Documents() {
  const pending = useQuery({
    ...signaturePendingQuery,
    // A geração do contrato e a criação dos participantes acontecem em
    // background; mantém a fila viva até o processo aparecer.
    refetchInterval: 4000,
  });
  const [selected, setSelected] = useState<ProfessionalSignItem | null>(null);
  const mine = (pending.data ?? []).filter((item) => item.role === 'professional' && item.status === 'pending');
  const waitingPatient = (pending.data ?? []).filter((item) => item.role === 'patient' && item.status === 'pending');

  return (
    <div className="grid gap-4">
      <section className="panel grid gap-3">
        <div className="panel-header"><div><div className="section-kicker">SUA VEZ</div><h2>Sua assinatura</h2></div></div>
        <QueryError query={pending} />
        {pending.isSuccess && mine.length === 0 && <p className="m-0 text-sm text-muted-foreground">Nenhum contrato esperando sua assinatura de representante.</p>}
        {mine.map((item) => (
          <div className="procedure-row" key={item.participantId}>
            <FileSignature size={18} />
            <span className="procedure-info"><strong>{item.title}</strong><small>{item.patient.fullName}{item.blocking ? ' · bloqueia a liberação do plano' : ''}</small></span>
            <Button
              size="sm"
              onClick={() => setSelected({ participantId: item.participantId, followupContractId: item.contractId, title: item.title, patientName: item.patient.fullName })}
            >
              Revisar e assinar
            </Button>
          </div>
        ))}
      </section>
      <section className="panel grid gap-3">
        <div className="panel-header"><div><div className="section-kicker">AGUARDANDO PACIENTE</div><h2>Falta o paciente</h2></div></div>
        {pending.isSuccess && waitingPatient.length === 0 && <p className="m-0 text-sm text-muted-foreground">Nenhum contrato parado com o paciente.</p>}
        {waitingPatient.map((item) => (
          <div className="procedure-row" key={item.participantId}>
            <Hourglass size={18} />
            <span className="procedure-info"><strong>{item.title}</strong><small>{item.patient.fullName}</small></span>
            <span className="flex items-center gap-2">
              {item.blocking && <StatusBadge tone="warning">Bloqueia liberação</StatusBadge>}
              <Link className="text-button" to="/pacientes/$patientId" params={{ patientId: item.patient.id }}>Abrir paciente</Link>
            </span>
          </div>
        ))}
      </section>
      <ProfessionalSignDialog item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
