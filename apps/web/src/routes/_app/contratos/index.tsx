import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FileText, Pencil } from 'lucide-react';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { ContractVersionsButton } from '@/components/VersionsDialog';
import { Button } from '@/components/ui/button';
import { combosQuery, contractsQuery, proceduresQuery } from '@/lib/queries';
import type { Contract } from '@/lib/schemas';
import { originLabel } from '@/lib/versions';

export const Route = createFileRoute('/_app/contratos/')({ component: Contracts });

function Contracts() {
  const contracts = useQuery(contractsQuery);
  const procedures = useQuery(proceduresQuery).data ?? [];
  const combos = useQuery(combosQuery).data ?? [];
  const scope = (contract: Contract) => {
    if (contract.kind === 'procedure') return `Procedimento: ${procedures.find((procedure) => procedure.id === contract.procedureId)?.name ?? '—'}`;
    if (contract.kind === 'combo') return `Combo: ${combos.find((combo) => combo.id === contract.comboId)?.name ?? '—'}`;
    return 'Padrão (todo acompanhamento)';
  };
  return (
    <section className="panel">
      <div className="panel-header"><h2>Contratos</h2><Button asChild><Link to="/contratos/novo">＋ Novo contrato</Link></Button></div>
      <QueryError query={contracts} />
      {(contracts.data ?? []).map((contract) => {
        const current = contract.versions.at(-1);
        return (
          <div className="procedure-row" key={contract.id}>
            <FileText size={18} />
            <span className="procedure-info">
              <strong>{contract.title}</strong>
              <small>{scope(contract)} · {contract.versions.length} {contract.versions.length === 1 ? 'versão' : 'versões'} · atual v{current?.version}{current && current.origin && current.origin !== 'created' ? ` (${originLabel(current).toLowerCase()})` : ''}</small>
            </span>
            {!contract.active && <StatusBadge tone="neutral">Inativo</StatusBadge>}
            <div className="row-actions flex gap-2">
              <Button variant="outline" size="sm" asChild><Link to="/contratos/$contractId" params={{ contractId: contract.id }}><Pencil /> Editar</Link></Button>
              <ContractVersionsButton contract={contract} />
            </div>
          </div>
        );
      })}
      <p className="section-note">Assinatura digital não faz parte desta versão do protótipo.</p>
    </section>
  );
}
