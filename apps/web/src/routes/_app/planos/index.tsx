import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Layers, Pencil, Trash2 } from 'lucide-react';
import { useDeletePlan } from '@/lib/queries';
import { QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { currency } from '@/lib/format';
import { plansQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/planos/')({ component: Plans });

function Plans() {
  const plans = useQuery(plansQuery);
  const remove = useDeletePlan();
  return (
    <section className="panel">
      <div className="panel-header"><h2>Planos</h2><Button asChild><Link to="/planos/novo">＋ Novo plano</Link></Button></div>
      <QueryError query={plans} />
      {plans.isSuccess && plans.data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum plano cadastrado. Um plano agrupa procedimentos e combos com contratos, duração e validade.</p>}
      {(plans.data ?? []).map((plan) => (
        <div className="procedure-row" key={plan.id}>
          <Layers size={18} />
          <span className="procedure-info">
            <strong>{plan.name}</strong>
            <small>
              {plan.items.length} {plan.items.length === 1 ? 'item' : 'itens'} · {plan.contractIds.length} {plan.contractIds.length === 1 ? 'contrato' : 'contratos'}
              {plan.durationDays ? ` · duração ${plan.durationDays} dias` : ''}
              {plan.validityDays ? ` · validade ${plan.validityDays} dias` : ''}
            </small>
          </span>
          <strong>{currency(plan.priceCents)}</strong>
          <Button variant="ghost" size="sm" asChild aria-label={`Editar ${plan.name}`}><Link to="/planos/novo" search={{ planId: plan.id }}><Pencil /></Link></Button>
          <Button variant="ghost" size="sm" className="text-destructive" disabled={remove.isPending} onClick={() => { if (window.confirm('Excluir este plano?')) remove.mutate(plan.id); }} aria-label={`Excluir ${plan.name}`}><Trash2 /></Button>
        </div>
      ))}
    </section>
  );
}
