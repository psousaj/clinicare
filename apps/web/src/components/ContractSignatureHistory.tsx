import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Check, FileDown, FileSignature, History, Link2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dateTime } from '@/lib/format';
import { copyTextToClipboard } from '@/lib/clipboard';
import { signatureHistoryQuery, useGenerateFollowupContract, useRefreshSignatureLink, useReprocessFollowupContract } from '@/lib/queries';

// Bloco do contrato aplicado no painel: rótulo, nome + status sempre
// visíveis, ação de copiar o link ao lado e histórico expansível com
// revisões para download, tentativas e linha do tempo de eventos.
// Texto neutro: assinatura eletrônica simples, sem alegar certificação,
// reconhecimento de firma ou aprovação jurídica.
//
// O link fica ao lado do nome porque é a ação mais frequente; gerá-lo
// continua sendo um gesto explícito porque cada geração revoga o token
// anterior.
export function ContractSignatureHistory({ followupContractId, title, signedAt, status, reprocessable }: {
  followupContractId: string;
  title: string;
  signedAt?: string | null;
  status?: string | null;
  reprocessable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const history = useQuery({ ...signatureHistoryQuery(followupContractId) });
  const refreshLink = useRefreshSignatureLink();
  const patientPending = history.data?.participants.find((participant) => participant.role === 'patient' && participant.status !== 'signed');

  useEffect(() => () => {
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
  }, []);

  async function copySignatureLink(participantId: string) {
    const url = await refreshLink.mutateAsync(participantId);
    setLink(url);
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    await copyTextToClipboard(url).then(
      (ok) => ok ? toast.success('Link copiado — é só colar no navegador.') : toast.info('Não copiou sozinho — selecione e copie o link abaixo.'),
    );
  }

  return (
    <div className="contract-block">
      <p className="section-kicker">Contrato</p>
      <div className="contract-head">
        <span className="contract-title">
          <FileSignature className="size-3.5" /> <strong>{title}</strong> · {signedAt ? 'assinado' : 'assinatura pendente'}
          {signedAt
            ? <StatusBadge tone="success">Assinado</StatusBadge>
            : <StatusBadge tone="warning">Pendente</StatusBadge>}
          {status === 'generating' && <StatusBadge tone="warning">Gerando documento</StatusBadge>}
          {status === 'failed' && <StatusBadge tone="danger">Falha na geração</StatusBadge>}
        </span>
        {patientPending && (
          <Button
            type="button"
            size="sm"
            disabled={refreshLink.isPending}
            onClick={() => copySignatureLink(patientPending.id).catch(() => undefined)}
          >
            {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}{' '}
            {refreshLink.isPending ? 'Gerando link…' : copied ? 'Copiado!' : 'Copiar link de assinatura'}
          </Button>
        )}
      </div>
      {patientPending && link && <Input readOnly value={link} aria-label="Link de assinatura" className="signature-link-field" onFocus={(event) => event.target.select()} />}
      <div className="contract-toolbar">
        {(status === 'generating' || status === 'failed') && (
          <ContractGenerateButton followupContractId={followupContractId} failed={status === 'failed'} />
        )}
        {reprocessable && <ContractReprocessButton followupContractId={followupContractId} title={title} />}
        <Button type="button" variant="outline" size="sm" className="contract-history-toggle !border-[#5f6b65] !bg-[#5f6b65] !text-white hover:!border-[#52605a] hover:!bg-[#52605a] hover:!text-white" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <History className="size-3.5" /> {open ? 'Ocultar histórico de assinaturas' : 'Histórico de assinaturas'}
        </Button>
      </div>
      {open && (
        <div className="signature-history">
          <QueryError query={history} />
          {history.data && (
            <>
              <div className="signature-history__head">
                <strong>{title}</strong>
                <StatusBadge tone={history.data.process.status === 'completed' ? 'success' : history.data.process.status === 'cancelled' ? 'danger' : 'warning'}>
                  {history.data.process.statusLabel}
                </StatusBadge>
              </div>
              <ul className="signature-history__list" aria-label="Participantes">
                {history.data.participants.map((participant) => (
                  <li key={participant.id} className="signature-history__row">
                    <span>{participant.roleLabel}</span>
                    <StatusBadge tone={participant.status === 'signed' ? 'success' : 'neutral'}>{participant.statusLabel}</StatusBadge>
                    {participant.signedAt && <span className="text-muted-foreground">{dateTime(participant.signedAt)}</span>}
                  </li>
                ))}
              </ul>
              {history.data.document?.revisions && (
                <ul className="signature-history__list" aria-label="Revisões preservadas">
                  {history.data.document.revisions.map((revision) => (
                    <li key={revision.id} className="signature-history__row signature-history__row--card">
                      <span className="signature-history__revision">
                        <strong>Revisão {revision.version}</strong>
                        <span>{revision.originLabel}</span>
                        {revision.promotedBy && <span className="text-muted-foreground">{revision.promotedBy.methodLabel}</span>}
                        <span className="text-muted-foreground">{dateTime(revision.createdAt)}</span>
                      </span>
                      {revision.downloadUrl && <a className="text-button inline-flex items-center gap-1" href={revision.downloadUrl}><FileDown className="size-3.5" /> Baixar PDF</a>}
                    </li>
                  ))}
                </ul>
              )}
              {history.data.externalAttempts.length > 0 && (
                <ul className="signature-history__list" aria-label="Tentativas externas">
                  {history.data.externalAttempts.map((attempt) => (
                    <li key={attempt.id} className="signature-history__row">GOV.BR · {attempt.lifecycleLabel}{attempt.validationLabel ? ` · ${attempt.validationLabel}` : ''}</li>
                  ))}
                </ul>
              )}
              <ol className="signature-history__list" aria-label="Linha do tempo">
                {history.data.events.map((event) => (
                  <li key={event.id} className="signature-history__row">
                    <span className="text-muted-foreground">{dateTime(event.occurredAt)}</span>
                    <span><strong>{event.actor.name}</strong> ({event.actor.role}) — {event.label}</span>
                    {event.method && <span className="text-muted-foreground">{event.method}</span>}
                    {event.revision && <span className="text-muted-foreground">{event.revision}</span>}
                  </li>
                ))}
              </ol>
              {history.data.notice && <p className="signature-history__notice">{history.data.notice}</p>}
            </>
          )}
        </div>
      )}
    </div>
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
// botão some assim que houver qualquer assinatura (trava do backend: 409)
// e, na página de documentos, aparece desabilitado com o motivo.
export function ContractReprocessButton({ followupContractId, title, disabled, disabledReason }: { followupContractId: string; title: string; disabled?: boolean; disabledReason?: string }) {
  const reprocess = useReprocessFollowupContract();
  const locked = Boolean(disabled);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={locked || reprocess.isPending}
      title={locked ? (disabledReason ?? 'Contrato já possui assinatura e não pode ser reprocessado.') : undefined}
      aria-label={locked ? `Reprocessamento bloqueado: ${title} já possui assinatura` : `Reprocessar ${title} com os dados atuais`}
      onClick={() => {
        if (locked) return;
        if (window.confirm(`Reprocessar o PDF de ${title} com os dados atuais do paciente? O documento atual será substituído e links de assinatura pendentes deixam de valer.`)) reprocess.mutate(followupContractId);
      }}
    >
      <RefreshCw className="size-3.5" /> {reprocess.isPending ? 'Reprocessando…' : 'Reprocessar PDF'}
    </Button>
  );
}
