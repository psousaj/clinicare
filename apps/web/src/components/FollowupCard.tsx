import { Link } from '@tanstack/react-router';
import { FileSignature, RefreshCw } from 'lucide-react';
import { ContractSignatureHistory } from '@/components/ContractSignatureHistory';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { currency } from '@/lib/format';
import { useGenerateFollowupContract } from '@/lib/queries';
import type { Followup } from '@/lib/schemas';

const offerLabel = { procedure: 'Avulso', combo: 'Combo', plan: 'Plano', event: 'Evento' } as const;

// Acompanhamento do paciente: itens com progresso, contratos exigidos e situação para agendar.
export function FollowupCard({ followup, patientId }: { followup: Followup; patientId: string }) {
  const expired = !!followup.validUntil && new Date(followup.validUntil) < new Date();
  return (
    <div className="followup-card mb-3 grid gap-1 rounded-lg border border-border p-3 last:mb-0">
      <div className="flex flex-wrap items-center gap-2">
        {/* Evento não tem preço contratado: o valor exibido é o realizado, que nasce da baixa. */}
        <strong>{followup.offerName} · {followup.offerType === 'event' ? `realizado ${currency(followup.priceCents)}` : currency(followup.priceCents)}</strong>
        <StatusBadge tone="neutral">{offerLabel[followup.offerType]}</StatusBadge>
        {expired && <StatusBadge tone="danger">Vencido</StatusBadge>}
        {followup.blocked && <StatusBadge tone="warning">Anamnese pendente</StatusBadge>}
      </div>
      {followup.validUntil && !expired && <small className="text-xs text-muted-foreground">Válido até {new Date(followup.validUntil).toLocaleDateString('pt-BR')}</small>}
      {followup.items.map((item) => {
        const done = item.sessionsPerformed >= item.sessionsTotal;
        return (
          <div className="procedure-row" key={item.id}>
            <span className="procedure-info grid gap-1">
              <span>{item.procedureName}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-accent"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (item.sessionsPerformed / item.sessionsTotal) * 100)}%` }} /></span>
                {item.sessionsPerformed}/{item.sessionsTotal} {followup.offerType === 'procedure' ? 'sessões' : 'sessões do plano'}
              </span>
            </span>
            {done
              ? <span className="text-xs font-medium text-primary">Concluído</span>
              : <Link className="text-button" to="/pacientes/$patientId/novo-atendimento/$itemId" params={{ patientId, itemId: item.id }}>Registrar atendimento</Link>}
          </div>
        );
      })}
      {followup.contracts.length > 0 && (
        <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-xs text-muted-foreground" aria-label={`Contratos de ${followup.offerName}`}>
          {followup.contracts.map((contract, index) => (
            <li key={contract.id ?? index} id={contract.id ? `followup-contract-${contract.id}` : undefined} className="grid scroll-mt-24 gap-1">
              <span className="flex flex-wrap items-center gap-2"><FileSignature className="size-3.5" /> {contract.title} · {contract.signedAt ? 'assinado' : 'assinatura pendente'}
                {contract.status === 'generating' && <StatusBadge tone="warning">Gerando documento</StatusBadge>}
                {contract.status === 'failed' && <StatusBadge tone="danger">Falha na geração</StatusBadge>}
              </span>
              {contract.id && (contract.status === 'generating' || contract.status === 'failed') && (
                <ContractGenerateButton followupContractId={contract.id} failed={contract.status === 'failed'} />
              )}
              {contract.id && <ContractSignatureHistory followupContractId={contract.id} title={contract.title ?? 'Contrato'} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContractGenerateButton({ followupContractId, failed }: { followupContractId: string; failed?: boolean }) {
  const generate = useGenerateFollowupContract();
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={generate.isPending}
        onClick={() => generate.mutate(followupContractId)}
      >
        <RefreshCw className="size-3.5" /> {generate.isPending ? 'Gerando…' : failed ? 'Tentar gerar de novo' : 'Gerar documento agora'}
      </Button>
    </div>
  );
}
