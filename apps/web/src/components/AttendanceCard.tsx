import { Link } from '@tanstack/react-router';
import { FileSignature } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { currency } from '@/lib/format';
import type { Attendance } from '@/lib/schemas';

const offerLabel = { procedure: 'Avulso', combo: 'Combo', plan: 'Plano' } as const;

// Atendimento do paciente: itens com progresso, contratos exigidos e situação para agendar.
export function AttendanceCard({ attendance, patientId }: { attendance: Attendance; patientId: string }) {
  const expired = !!attendance.validUntil && new Date(attendance.validUntil) < new Date();
  return (
    <div className="attendance-card mb-3 grid gap-1 rounded-lg border border-border p-3 last:mb-0">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{attendance.offerName} · {currency(attendance.priceCents)}</strong>
        <StatusBadge tone="neutral">{offerLabel[attendance.offerType]}</StatusBadge>
        {expired && <StatusBadge tone="danger">Vencido</StatusBadge>}
        {attendance.blocked && <StatusBadge tone="warning">Anamnese pendente</StatusBadge>}
      </div>
      {attendance.validUntil && !expired && <small className="text-xs text-muted-foreground">Válido até {new Date(attendance.validUntil).toLocaleDateString('pt-BR')}</small>}
      {attendance.items.map((item) => {
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
              : <Link className="text-button" to="/pacientes/$patientId/sessao/$itemId" params={{ patientId, itemId: item.id }}>Registrar sessão</Link>}
          </div>
        );
      })}
      {attendance.contracts.length > 0 && (
        <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-xs text-muted-foreground" aria-label={`Contratos de ${attendance.offerName}`}>
          {attendance.contracts.map((contract, index) => (
            <li key={index} className="flex items-center gap-2"><FileSignature className="size-3.5" /> {contract.title} · {contract.signedAt ? 'assinado' : 'assinatura pendente'}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
