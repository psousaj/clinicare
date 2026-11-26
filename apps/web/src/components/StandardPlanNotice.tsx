import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { saasSubscriptionQuery } from '@/lib/queries';

export function StandardPlanNotice() {
  const subscription = useQuery(saasSubscriptionQuery);
  if (subscription.isPending) return <p role="status" className="text-sm text-muted-foreground">Verificando recursos do plano…</p>;
  if (subscription.isError) return <p role="alert" className="text-sm text-destructive">Não foi possível verificar os recursos do plano.</p>;
  if (subscription.data.effectivePlan !== 'free') return null;
  return (
    <p role="note" className="rounded-lg border border-border bg-muted p-3 text-sm">
      Combos, planos clínicos e acompanhamentos estão disponíveis no Standard.{' '}
      <Link className="underline" to="/planos-saas">Conheça os planos</Link>
    </p>
  );
}
