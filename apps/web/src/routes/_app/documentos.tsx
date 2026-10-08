import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { FileSignature, Hourglass } from 'lucide-react';
import { ContractReprocessButton } from '@/components/ContractSignatureHistory';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { signaturePendingQuery } from '@/lib/queries';

// Documentos: fila de assinaturas do lado da clínica. O representante assina
// na página dedicada /documentos/:id/assinar; o paciente assina pelo link
// público copiado no histórico do contrato.
export const Route = createFileRoute('/_app/documentos')({ component: Documents });

function Documents() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // `documentos` is also the route parent for the dedicated signing page.
  // Render the child in place instead of leaving the list mounted above it.
  if (pathname.includes('/assinar')) return <Outlet />;

  return <DocumentsContent />;
}

function DocumentsContent() {
  const pending = useQuery({
    ...signaturePendingQuery,
    // A geração do contrato e a criação dos participantes acontecem em
    // background; mantém a fila viva até o processo aparecer.
    refetchInterval: 4000,
  });
  const mine = (pending.data ?? []).filter((item) => item.role === 'professional' && item.status === 'pending');
  const waitingPatient = (pending.data ?? []).filter((item) => item.role === 'patient' && item.status === 'pending');
  const queue = mine.map((item) => item.contractId).join(',');

  return (
    <div className="grid gap-4">
      <section className="panel grid gap-3">
        <div className="panel-header"><div><div className="section-kicker">SUA VEZ</div><h2>Sua assinatura</h2></div>
          {mine.length > 0 && <span className="text-sm font-medium text-muted-foreground" role="status">{mine.length} aguardando sua assinatura</span>}
        </div>
        <QueryError query={pending} />
        {pending.isSuccess && mine.length === 0 && <p className="m-0 text-sm text-muted-foreground">Nenhum contrato esperando sua assinatura de representante.</p>}
        {mine.map((item) => (
          <div className="procedure-row" key={item.participantId}>
            <FileSignature size={18} />
            <span className="procedure-info"><strong>{item.title}</strong><small>{item.patient.fullName}{item.blocking ? ' · bloqueia a liberação do plano' : ''}</small></span>
            <span className="flex items-center gap-2">
              <ContractReprocessButton followupContractId={item.contractId} title={item.title} />
              <Button size="sm" asChild>
                <Link
                  to="/documentos/$followupContractId/assinar"
                  params={{ followupContractId: item.contractId }}
                  search={{ queue, participant: item.participantId }}
                >
                  Revisar e assinar
                </Link>
              </Button>
            </span>
          </div>
        ))}
        {mine.length > 1 && (
          <div>
            <Button size="sm" variant="outline" asChild>
              <Link to="/documentos/$followupContractId/assinar" params={{ followupContractId: mine[0]!.contractId }} search={{ queue }}>
                Assinar todos em sequência ({mine.length})
              </Link>
            </Button>
          </div>
        )}
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
              <ContractReprocessButton followupContractId={item.contractId} title={item.title} />
              <Link className="text-button" to="/pacientes/$patientId" params={{ patientId: item.patient.id }}>Abrir paciente</Link>
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
