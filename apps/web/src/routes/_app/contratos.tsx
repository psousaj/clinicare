import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { ContractDialog } from '@/components/dialogs';
import { QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { contractsQuery, useRestoreContract } from '@/lib/queries';

export const Route = createFileRoute('/_app/contratos')({ component: Contracts });

function Contracts() {
  const contracts = useQuery(contractsQuery), restore = useRestoreContract();
  const [open, setOpen] = useState(false);
  return (
    <section className="panel">
      <div className="panel-header"><h2>Contratos e documentos modelo</h2><Button onClick={() => setOpen(true)}>＋ Novo contrato</Button></div>
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
      <ContractDialog open={open} onOpenChange={setOpen} />
    </section>
  );
}
