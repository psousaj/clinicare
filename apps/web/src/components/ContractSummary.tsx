import { FileSignature } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { dateTime } from '@/lib/format';
import type { Followup } from '@/lib/schemas';

type Entry = { contract: Followup['contracts'][number]; followup: Followup };

function pendingBadge(status?: string | null) {
  if (status === 'generating') return <StatusBadge tone="warning">Gerando documento</StatusBadge>;
  if (status === 'failed') return <StatusBadge tone="danger">Falha na geração</StatusBadge>;
  return <StatusBadge tone="neutral">Aguardando assinatura</StatusBadge>;
}

// Resumo dos contratos dos acompanhamentos: pendentes e assinados lado a
// lado, com atalho para o contrato dentro de Acompanhamentos. As ações
// (gerar documento, histórico de assinaturas) moram só no FollowupCard.
export function ContractSummary({ followups }: { followups: Followup[] }) {
  const entries: Entry[] = followups.flatMap((followup) =>
    followup.contracts
      .filter((contract) => contract.id && contract.status !== 'cancelled')
      .map((contract) => ({ contract, followup })),
  );
  const pending = entries.filter(({ contract }) => !contract.signedAt);
  const signed = entries.filter(({ contract }) => !!contract.signedAt);
  if (entries.length === 0) return null;

  return (
    <section className="panel" aria-label="Contratos">
      <div className="panel-header"><div><div className="section-kicker">DOCUMENTOS</div><h2>Contratos</h2></div></div>
      {pending.length > 0 && (
        <div className="grid gap-1">
          <span className="section-kicker">PENDENTES</span>
          {pending.map(({ contract, followup }) => (
            <a key={contract.id} className="procedure-row no-underline" style={{ color: 'inherit' }} href={`#followup-contract-${contract.id}`}>
              <span className="procedure-info grid gap-0.5">
                <span className="flex flex-wrap items-center gap-2"><FileSignature className="size-3.5" /> {contract.title}</span>
                <small>{followup.offerName}</small>
              </span>
              {pendingBadge(contract.status)}
            </a>
          ))}
        </div>
      )}
      {signed.length > 0 && (
        <div className="grid gap-1">
          <span className="section-kicker">ASSINADOS</span>
          {signed.map(({ contract, followup }) => (
            <a key={contract.id} className="procedure-row no-underline" style={{ color: 'inherit' }} href={`#followup-contract-${contract.id}`}>
              <span className="procedure-info grid gap-0.5">
                <span className="flex flex-wrap items-center gap-2"><FileSignature className="size-3.5" /> {contract.title}</span>
                <small>{followup.offerName}{contract.signedAt ? ` · assinado em ${dateTime(contract.signedAt)}` : ''}</small>
              </span>
              <StatusBadge tone="success">Assinado</StatusBadge>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
