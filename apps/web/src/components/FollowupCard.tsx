import { Link } from '@tanstack/react-router';
import { FileSignature } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { currency } from '@/lib/format';
import type { Followup } from '@/lib/schemas';

const offerLabel = { procedure: 'Avulso', combo: 'Combo', plan: 'Plano' } as const;

// Acompanhamento do paciente: itens com progresso, contratos exigidos e situação para agendar.
export function FollowupCard({ followup, patientId }: { followup: Followup; patientId: string }) {
  const expired = !!followup.validUntil && new Date(followup.validUntil) < new Date();
  return (
    <div className="followup-card mb-3 grid gap-1 rounded-lg border border-border p-3 last:mb-0">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{followup.offerName} · {currency(followup.priceCents)}</strong>
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
                {item.sessionsPerformed}/{item.sessionsTotal} sessões
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
            <li key={index} className="flex items-center gap-2"><FileSignature className="size-3.5" /> {contract.title} · {contract.signedAt ? 'assinado' : 'assinatura pendente'}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
