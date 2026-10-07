import { Link } from '@tanstack/react-router';
import { FileSignature, RefreshCw } from 'lucide-react';
import { ContractSignatureHistory } from '@/components/ContractSignatureHistory';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { currency } from '@/lib/format';
import { useCancelFollowup, useCancelFollowupItem, useGenerateFollowupContract, useReprocessFollowupContract } from '@/lib/queries';
import type { Followup } from '@/lib/schemas';

const offerLabel = { procedure: 'Avulso', combo: 'Combo', plan: 'Plano', event: 'Evento' } as const;

// Acompanhamento do paciente: cabeçalho com estado, itens com progresso,
// contratos exigidos e uma seção de ações fácil de achar.
export function FollowupCard({ followup, patientId }: { followup: Followup; patientId: string }) {
  const expired = !!followup.validUntil && new Date(followup.validUntil) < new Date();
  const cancelItem = useCancelFollowupItem();
  const cancelFollowup = useCancelFollowup();
  const open = followup.status !== 'completed' && followup.status !== 'cancelled';
  const state = !open ? followup.status : followup.status === 'idle' ? 'idle' : 'active';
  const pendingAnamnesis = followup.anamneses.some((form) => form.required && !form.answered);
  const docContracts = followup.contracts.filter((contract) => contract.id && (contract.status === 'generating' || contract.status === 'failed'));
  const reprocessableContracts = followup.contracts.filter((contract) => contract.id && !contract.signedAt && contract.status !== 'signed' && contract.status !== 'cancelled');
  // Reprocessamento cancela a linha antiga e cria uma substituta: o contrato
  // continua sendo um só, então linhas canceladas são só auditoria e não
  // rendem área própria no card.
  const visibleContracts = followup.contracts.filter((contract) => contract.status !== 'cancelled');
  return (
    <article className="followup-card" data-state={state} aria-label={`${followup.offerName} (${offerLabel[followup.offerType]})`}>
      <header className="followup-card__head">
        <div className="followup-card__title">
          {/* Evento não tem preço contratado: o valor exibido é o realizado, que nasce da baixa. */}
          <strong>{followup.offerName}</strong>
          <span className="followup-card__meta">
            {offerLabel[followup.offerType]} · {followup.offerType === 'event' ? `realizado ${currency(followup.priceCents)}` : currency(followup.priceCents)}
            {followup.validUntil && ` · Válido até ${new Date(followup.validUntil).toLocaleDateString('pt-BR')}`}
          </span>
        </div>
        <div className="followup-card__badges">
          {expired && <StatusBadge tone="danger">Vencido</StatusBadge>}
          {followup.status === 'cancelled' && <StatusBadge tone="danger">Cancelado</StatusBadge>}
          {followup.status === 'completed' && <StatusBadge tone="success">Concluído</StatusBadge>}
        </div>
      </header>
      {state === 'idle' && (
        <p className="followup-alert" role="status">
          <strong>Aguardando assinatura</strong> — libera após a assinatura do paciente.
        </p>
      )}
      {state !== 'idle' && open && pendingAnamnesis && (
        <p className="followup-alert" role="status">
          <strong>Anamnese pendente</strong> — responda para liberar o agendamento.
        </p>
      )}
      {followup.offerType === 'event' && <p className="followup-card__note">O cardápio inteiro entra no acompanhamento. Deixe de realizar o que não for feito no dia.</p>}
      {followup.items.map((item) => {
        const done = item.sessionsPerformed >= item.sessionsTotal;
        const skipped = !!item.cancelledAt;
        const sessionsLabel = followup.offerType === 'event' ? 'sessões do dia' : followup.offerType === 'procedure' ? 'sessões' : 'sessões do plano';
        return (
          <div className="procedure-row" key={item.id}>
            <span className="procedure-info grid gap-1">
              <span>{item.procedureName}{item.comboName ? ` · ${item.comboName}` : ''}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-accent"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (item.sessionsPerformed / item.sessionsTotal) * 100)}%` }} /></span>
                {item.sessionsPerformed}/{item.sessionsTotal} {sessionsLabel}
              </span>
            </span>
            {skipped
              ? <span className="text-xs font-medium text-muted-foreground">Não realizado</span>
              : done
                ? <span className="text-xs font-medium text-primary">Concluído</span>
                : (
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    <Link className="text-button" to="/pacientes/$patientId/novo-atendimento/$itemId" params={{ patientId, itemId: item.id }}>Registrar atendimento</Link>
                    {followup.offerType === 'event' && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={cancelItem.isPending}
                        aria-label={`Não realizar ${item.procedureName}`}
                        onClick={() => {
                          const message = item.comboId
                            ? `Não realizar o combo ${item.comboName}? O pacote inteiro sai do que será feito neste evento.`
                            : `Não realizar ${item.procedureName} neste evento?`;
                          if (window.confirm(message)) cancelItem.mutate({ followupId: followup.id, itemId: item.id });
                        }}
                      >
                        Não realizar
                      </button>
                    )}
                  </span>
                )}
          </div>
        );
      })}
      {visibleContracts.length > 0 && (
        <ul className="followup-contracts" aria-label={`Contratos de ${followup.offerName}`}>
          {visibleContracts.map((contract, index) => (
            <li key={contract.id ?? index} id={contract.id ? `followup-contract-${contract.id}` : undefined} className="followup-contract scroll-mt-24">
              <span className="flex flex-wrap items-center gap-2"><FileSignature className="size-3.5" /> {contract.title} · {contract.signedAt ? 'assinado' : 'assinatura pendente'}
                {contract.status === 'generating' && <StatusBadge tone="warning">Gerando documento</StatusBadge>}
                {contract.status === 'failed' && <StatusBadge tone="danger">Falha na geração</StatusBadge>}
              </span>
              {contract.id && <ContractSignatureHistory followupContractId={contract.id} title={contract.title ?? 'Contrato'} />}
            </li>
          ))}
        </ul>
      )}
      {(docContracts.length > 0 || reprocessableContracts.length > 0 || open) && (
        <footer className="followup-actions" aria-label={`Ações de ${followup.offerName}`}>
          <span className="followup-actions__label">Ações</span>
          {docContracts.map((contract) => (
            <ContractGenerateButton key={`generate-${contract.id}`} followupContractId={contract.id!} failed={contract.status === 'failed'} />
          ))}
          {reprocessableContracts.map((contract) => (
            <ContractReprocessButton key={`reprocess-${contract.id}`} followupContractId={contract.id!} title={contract.title ?? 'Contrato'} />
          ))}
          {open && <span className="followup-actions__spacer" />}
          {open && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={cancelFollowup.isPending}
              aria-label={`Cancelar acompanhamento ${followup.offerName}`}
              onClick={() => {
                const reason = window.prompt(`Cancelar o acompanhamento ${followup.offerName}? Digite o motivo (obrigatório):`);
                if (reason === null) return;
                if (!reason.trim()) {
                  window.alert('O motivo do cancelamento é obrigatório.');
                  return;
                }
                cancelFollowup.mutate({ followupId: followup.id, reason: reason.trim() });
              }}
            >
              Cancelar acompanhamento
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}

function ContractGenerateButton({ followupContractId, failed }: { followupContractId: string; failed?: boolean }) {
  const generate = useGenerateFollowupContract();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={generate.isPending}
      onClick={() => generate.mutate(followupContractId)}
    >
      <RefreshCw className="size-3.5" /> {generate.isPending ? 'Gerando…' : failed ? 'Tentar gerar de novo' : 'Gerar documento agora'}
    </Button>
  );
}

// Reprocessa o R0 com os dados atuais do paciente. O documento atual é
// substituído e links de assinatura pendentes deixam de valer — por isso o
// botão some assim que houver qualquer assinatura.
export function ContractReprocessButton({ followupContractId, title }: { followupContractId: string; title: string }) {
  const reprocess = useReprocessFollowupContract();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={reprocess.isPending}
      aria-label={`Reprocessar ${title} com os dados atuais`}
      onClick={() => {
        if (window.confirm(`Reprocessar o PDF de ${title} com os dados atuais do paciente? O documento atual será substituído e links de assinatura pendentes deixam de valer.`)) reprocess.mutate(followupContractId);
      }}
    >
      <RefreshCw className="size-3.5" /> {reprocess.isPending ? 'Reprocessando…' : 'Reprocessar PDF'}
    </Button>
  );
}
