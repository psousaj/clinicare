import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ClipboardList, Pencil } from 'lucide-react';
import { QueryError } from '@/components/QueryState';
import { VersionsButton } from '@/components/VersionsDialog';
import { Button } from '@/components/ui/button';
import { anamnesesQuery } from '@/lib/queries';
import { originLabel } from '@/lib/versions';

export const Route = createFileRoute('/_app/formularios-anamnese/')({ component: Anamneses });

function Anamneses() {
  const anamneses = useQuery(anamnesesQuery);
  return (
    <section className="panel">
      <div className="panel-header"><h2>Formulários de anamnese</h2><Button asChild><Link to="/formularios-anamnese/nova">＋ Novo formulário de anamnese</Link></Button></div>
      <QueryError query={anamneses} />
      {(anamneses.data ?? []).map((anamnesis) => {
        const current = anamnesis.versions.at(-1);
        return (
          <div className="procedure-row" key={anamnesis.id}>
            <ClipboardList size={18} />
            <span className="procedure-info">
              <strong>{anamnesis.title}</strong>
              <small>{anamnesis.versions.length} {anamnesis.versions.length === 1 ? 'versão' : 'versões'} · atual v{current?.version}{current && current.origin && current.origin !== 'created' ? ` (${originLabel(current).toLowerCase()})` : ''}</small>
            </span>
            <div className="row-actions flex gap-2">
              <Button variant="outline" size="sm" asChild><Link to="/formularios-anamnese/$anamnesisId" params={{ anamnesisId: anamnesis.id }}><Pencil /> Editar</Link></Button>
              <VersionsButton anamnesis={anamnesis} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
