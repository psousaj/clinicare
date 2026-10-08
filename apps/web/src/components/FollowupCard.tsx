import { Link } from '@tanstack/react-router';
import { FileSignature, Lock } from 'lucide-react';
import { useState } from 'react';
import { ContractSignatureHistory } from '@/components/ContractSignatureHistory';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { currency } from '@/lib/format';
import { useCancelFollowup, useCancelFollowupItem } from '@/lib/queries';
import type { Followup } from '@/lib/schemas';

const offerLabel = { procedure: 'Avulso', combo: 'Combo', plan: 'Plano', event: 'Evento' } as const;

// Acompanhamento do paciente: cabeçalho com estado, itens com progresso,
// contratos exigidos e uma seção de ações fácil de achar.
export function FollowupCard({ followup, patientId }: { followup: Followup; patientId: string }) {
  const expired = !!followup.validUntil && new Date(followup.validUntil) < new Date();
  const cancelItem = useCancelFollowupItem();
  const cancelFollowup = useCancelFollowup();
  const [cancelOpen, setCancelOpen] = useState(false);
  const open = followup.status !== 'completed' && followup.status !== 'cancelled';
  // O backend só aceita atendimento em acompanhamento ativo; fora disso o
  // botão aparece bloqueado em vez de um link que quebraria no servidor.
  const canRegister = open && followup.status === 'active';
  const validityDays = followup.validUntil ? Math.ceil((new Date(followup.validUntil).getTime() - Date.now()) / 86400000) : null;
  const state = !open ? followup.status : followup.status === 'idle' ? 'idle' : 'active';
  const pendingAnamnesis = followup.anamneses.some((form) => form.required && !form.answered);
  const reprocessableContracts = followup.contracts.filter((contract) => contract.id && !contract.signedAt && !contract.patientSigned && !contract.professionalSigned && contract.status !== 'signed' && contract.status !== 'cancelled');
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
            {validityDays !== null && !expired && validityDays <= 30 && ` · vence ${validityDays <= 0 ? 'hoje' : `em ${validityDays} dia${validityDays === 1 ? '' : 's'}`}`}
          </span>
        </div>
        <div className="followup-card__badges">
          {expired && <StatusBadge tone="danger">Vencido</StatusBadge>}
          {followup.status === 'cancelled' && <StatusBadge tone="danger">Cancelado</StatusBadge>}
          {followup.status === 'completed' && <StatusBadge tone="success">Concluído</StatusBadge>}
        </div>
      </header>
      {state === 'idle' && visibleContracts.length === 0 && (
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
                <span className="h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-accent"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (item.sessionsPerformed / item.sessionsTotal) * 100)}%` }} /></span>
                {item.sessionsPerformed} de {item.sessionsTotal} {sessionsLabel}
              </span>
            </span>
            {skipped
              ? <span className="text-xs font-medium text-muted-foreground">Não realizado</span>
              : done
                ? <span className="text-xs font-medium text-primary">Concluído</span>
                : (
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    {canRegister
                      ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/pacientes/$patientId/novo-atendimento/$itemId" params={{ patientId, itemId: item.id }}>Registrar atendimento</Link>
                        </Button>
                      )
                      : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          title={followup.status === 'idle' ? 'Disponível após a assinatura do paciente.' : 'Acompanhamento encerrado.'}
                        >
                          <Lock className="size-3.5" /> Registrar atendimento
                        </Button>
                      )}
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
            <li key={contract.id ?? index} id={contract.id ? `followup-contract-${contract.id}` : undefined} className={`followup-contract scroll-mt-24${contract.signedAt ? '' : ' followup-contract--pending'}`}>
              {contract.id
                ? <ContractSignatureHistory followupContractId={contract.id} title={contract.title ?? 'Contrato'} signedAt={contract.signedAt} status={contract.status} reprocessable={reprocessableContracts.some((item) => item.id === contract.id)} />
                : <span className="flex flex-wrap items-center gap-2"><FileSignature className="size-3.5" /> {contract.title} · {contract.signedAt ? 'assinado' : 'assinatura pendente'}</span>}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <footer className="followup-actions followup-actions--end" aria-label={`Ações de ${followup.offerName}`}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Cancelar acompanhamento ${followup.offerName}`}
            onClick={() => setCancelOpen(true)}
          >
            Cancelar acompanhamento
          </Button>
          <CancelFollowupDialog
            open={cancelOpen}
            offerName={followup.offerName}
            pending={cancelFollowup.isPending}
            onClose={() => setCancelOpen(false)}
            onConfirm={(reason) => cancelFollowup.mutate({ followupId: followup.id, reason }, { onSuccess: () => setCancelOpen(false) })}
          />
        </footer>
      )}
    </article>
  );
}

function CancelFollowupDialog({ open, offerName, pending, onClose, onConfirm }: {
  open: boolean;
  offerName: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { setReason(''); onClose(); } }}>
      <DialogContent aria-label={`Cancelar acompanhamento ${offerName}`}>
        <DialogHeader>
          <DialogTitle>Cancelar acompanhamento</DialogTitle>
          <DialogDescription>
            {offerName} sai da lista de acompanhamentos em andamento. As sessões já realizadas são mantidas, mas o contrato pendente é cancelado e os links de assinatura deixam de valer.
          </DialogDescription>
        </DialogHeader>
        <Label className="flex-col items-stretch gap-1.5">
          Motivo do cancelamento
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Ex.: paciente desistiu do plano" />
        </Label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { setReason(''); onClose(); }}>Voltar</Button>
          <Button type="button" variant="destructive" disabled={!reason.trim() || pending} onClick={() => onConfirm(reason.trim())}>
            {pending ? 'Cancelando…' : 'Confirmar cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
