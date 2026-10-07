import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FileDown, History, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dateTime } from '@/lib/format';
import { signatureHistoryQuery, useRefreshSignatureLink } from '@/lib/queries';

// Histórico legível do contrato aplicado no painel: processo, participantes,
// revisões preservadas com download, tentativas e linha do tempo de eventos.
// Texto neutro: assinatura eletrônica simples, sem alegar certificação,
// reconhecimento de firma ou aprovação jurídica.
export function ContractSignatureHistory({ followupContractId, title }: { followupContractId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const history = useQuery({ ...signatureHistoryQuery(followupContractId), enabled: open });
  const refreshLink = useRefreshSignatureLink();
  const patientPending = history.data?.participants.find((participant) => participant.role === 'patient' && participant.status !== 'signed');

  async function copySignatureLink(participantId: string) {
    const url = await refreshLink.mutateAsync(participantId);
    setLink(url);
    await navigator.clipboard.writeText(url).then(() => toast.success('Link copiado — envie ao paciente.'), () => toast.info('Copie o link exibido abaixo.'));
  }

  return (
    <div className="mt-1">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <History className="size-3.5" /> {open ? 'Ocultar histórico de assinaturas' : 'Histórico de assinaturas'}
      </Button>
      {open && (
        <div className="mt-2 grid gap-2 rounded-lg border border-border p-3">
          <QueryError query={history} />
          {history.data && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <strong>{title}</strong>
                <StatusBadge tone={history.data.process.status === 'completed' ? 'success' : history.data.process.status === 'cancelled' ? 'danger' : 'warning'}>
                  {history.data.process.statusLabel}
                </StatusBadge>
              </div>
              {patientPending && (
                <div className="grid gap-2">
                  <div>
                    <Button type="button" variant="outline" size="sm" disabled={refreshLink.isPending} onClick={() => copySignatureLink(patientPending.id).catch(() => undefined)}>
                      <Link2 className="size-3.5" /> {refreshLink.isPending ? 'Gerando link…' : 'Copiar link de assinatura'}
                    </Button>
                  </div>
                  {link && <Input readOnly value={link} aria-label="Link de assinatura" onFocus={(event) => event.target.select()} />}
                </div>
              )}
              <ul className="m-0 grid list-none gap-1 p-0 text-xs" aria-label="Participantes">
                {history.data.participants.map((participant) => (
                  <li key={participant.id} className="flex flex-wrap items-center gap-2">
                    <span>{participant.roleLabel}</span>
                    <StatusBadge tone={participant.status === 'signed' ? 'success' : 'neutral'}>{participant.statusLabel}</StatusBadge>
                    {participant.signedAt && <span className="text-muted-foreground">{dateTime(participant.signedAt)}</span>}
                  </li>
                ))}
              </ul>
              {history.data.document?.revisions && (
                <ul className="m-0 grid list-none gap-1 p-0 text-xs" aria-label="Revisões preservadas">
                  {history.data.document.revisions.map((revision) => (
                    <li key={revision.id} className="flex flex-wrap items-center gap-2">
                      <span>Revisão {revision.version} · {revision.originLabel}</span>
                      {revision.promotedBy && <span className="text-muted-foreground">{revision.promotedBy.methodLabel}</span>}
                      <span className="text-muted-foreground">{dateTime(revision.createdAt)}</span>
                      {revision.downloadUrl && <a className="text-button inline-flex items-center gap-1" href={revision.downloadUrl}><FileDown className="size-3.5" /> Baixar PDF</a>}
                    </li>
                  ))}
                </ul>
              )}
              {history.data.externalAttempts.length > 0 && (
                <ul className="m-0 grid list-none gap-1 p-0 text-xs" aria-label="Tentativas externas">
                  {history.data.externalAttempts.map((attempt) => (
                    <li key={attempt.id}>GOV.BR · {attempt.lifecycleLabel}{attempt.validationLabel ? ` · ${attempt.validationLabel}` : ''}</li>
                  ))}
                </ul>
              )}
              <ol className="m-0 grid list-none gap-1 p-0 text-xs" aria-label="Linha do tempo">
                {history.data.events.map((event) => (
                  <li key={event.id} className="flex flex-wrap gap-x-2">
                    <span className="text-muted-foreground">{dateTime(event.occurredAt)}</span>
                    <span><strong>{event.actor.name}</strong> ({event.actor.role}) — {event.label}</span>
                    {event.method && <span className="text-muted-foreground">{event.method}</span>}
                    {event.revision && <span className="text-muted-foreground">{event.revision}</span>}
                  </li>
                ))}
              </ol>
              {history.data.notice && <p className="m-0 text-[11px] text-muted-foreground">{history.data.notice}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
