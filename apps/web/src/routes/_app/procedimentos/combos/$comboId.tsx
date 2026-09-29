import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ComboFormPage } from '@/components/ComboForm';
import { QueryError } from '@/components/QueryState';
import { combosQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/procedimentos/combos/$comboId')({ component: EditCombo });

function EditCombo() {
  const { comboId } = Route.useParams();
  const combos = useQuery(combosQuery);
  const combo = combos.data?.find((candidate) => candidate.id === comboId);
  if (combo) return <ComboFormPage key={combo.id} combo={combo} />;
  return (
    <section className="panel">
      <QueryError query={combos} />
      {combos.isPending && <p className="section-note">Carregando…</p>}
      {combos.isSuccess && <p className="section-note" role="alert">Combo não encontrado.</p>}
    </section>
  );
}
