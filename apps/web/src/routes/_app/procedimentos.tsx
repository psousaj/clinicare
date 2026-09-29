import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { PackageDialog, ProcedureDialog } from '@/components/dialogs';
import { QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { currency } from '@/lib/format';
import { packagesQuery, proceduresQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/procedimentos')({ component: Procedures });

function Procedures() {
  const procedures = useQuery(proceduresQuery), packages = useQuery(packagesQuery);
  const [procedureOpen, setProcedureOpen] = useState(false), [packageOpen, setPackageOpen] = useState(false);
  return (
    <>
      <section className="panel">
        <div className="panel-header"><h2>Catálogo de procedimentos</h2><Button onClick={() => setProcedureOpen(true)}>＋ Novo procedimento</Button></div>
        <QueryError query={procedures} />
        {(procedures.data ?? []).map((procedure) => (
          <div className="procedure-row" key={procedure.id}>
            <Sparkles size={18} />
            <span className="procedure-info"><strong>{procedure.name}</strong><small>{procedure.baseSessions} sessões base · {procedure.durationMinutes ?? 'Duração flexível'} min</small></span>
            <strong>{currency(procedure.priceCents)}</strong>
          </div>
        ))}
      </section>
      <section className="panel">
        <div className="panel-header"><h2>Pacotes</h2><Button variant="outline" onClick={() => setPackageOpen(true)}>＋ Novo pacote</Button></div>
        <QueryError query={packages} />
        {(packages.data ?? []).map((pack) => (
          <div className="procedure-row" key={pack.id}>
            <Sparkles size={18} />
            <span className="procedure-info"><strong>{pack.name}</strong><small>{pack.items.length} procedimentos</small></span>
            <strong>{currency(pack.promotionalPriceCents ?? pack.priceCents)}</strong>
          </div>
        ))}
      </section>
      <ProcedureDialog open={procedureOpen} onOpenChange={setProcedureOpen} />
      <PackageDialog open={packageOpen} onOpenChange={setPackageOpen} procedures={procedures.data ?? []} />
    </>
  );
}
