import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { FileText } from 'lucide-react';
import { QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { contractsQuery, useRestoreContract } from '@/lib/queries';

export const Route = createFileRoute('/_app/contratos/')({ component: Contracts });

function Contracts() {
  const contracts = useQuery(contractsQuery), restore = useRestoreContract();
  return (
    <section className="panel">
      <div className="panel-header"><h2>Contratos e documentos modelo</h2><Button asChild><Link to="/contratos/novo">＋ Novo contrato</Link></Button></div>
      <QueryError query={contracts} />
      {(contracts.data ?? []).map((contract) => {
        const latest = contract.versions.at(-1);
        return (
          <div className="procedure-row" key={contract.id}>
            <FileText size={18} />
            <span className="procedure-info"><strong>{contract.title}</strong><small>{contract.kind} · {contract.versions.length} versões</small></span>
            {latest && <button className="text-button" onClick={() => restore.mutate({ id: contract.id, version: latest.version })}>Criar nova versão</button>}
          </div>
        );
      })}
      <p className="section-note">Assinatura digital não faz parte desta versão do protótipo.</p>
    </section>
  );
}
