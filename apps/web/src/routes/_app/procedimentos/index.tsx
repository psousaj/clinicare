import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { currency } from '@/lib/format';
import { combosQuery, proceduresQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/procedimentos/')({ component: Procedures });

function Procedures() {
  const procedures = useQuery(proceduresQuery), combos = useQuery(combosQuery);
  return (
    <>
      <section className="panel">
        <div className="panel-header"><h2>Catálogo de procedimentos</h2><Button asChild><Link to="/procedimentos/novo">＋ Novo procedimento</Link></Button></div>
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
        <div className="panel-header"><h2>Combos</h2><Button variant="outline" asChild><Link to="/procedimentos/combos/novo">＋ Novo combo</Link></Button></div>
        <QueryError query={combos} />
        {(combos.data ?? []).map((combo) => (
          <div className="procedure-row" key={combo.id}>
            <Sparkles size={18} />
            <span className="procedure-info">
              <strong>{combo.name}{combo.promotionalPriceCents != null && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Promocional</span>}</strong>
              <small>{combo.items.length} {combo.items.length === 1 ? 'procedimento' : 'procedimentos'}{combo.validUntil && ` · válido até ${new Date(combo.validUntil).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`}</small>
            </span>
            <strong>{currency(combo.promotionalPriceCents ?? combo.priceCents)}</strong>
          </div>
        ))}
      </section>
    </>
  );
}
