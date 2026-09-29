import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { AnamnesisDialog } from '@/components/dialogs';
import { QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { anamnesesQuery, useRestoreAnamnesis } from '@/lib/queries';

export const Route = createFileRoute('/_app/anamneses')({ component: Anamneses });

function Anamneses() {
  const anamneses = useQuery(anamnesesQuery), restore = useRestoreAnamnesis();
  const [open, setOpen] = useState(false);
  return (
    <section className="panel">
      <div className="panel-header"><h2>Formulários de anamnese</h2><Button onClick={() => setOpen(true)}>＋ Nova anamnese</Button></div>
      <QueryError query={anamneses} />
      {(anamneses.data ?? []).map((anamnesis) => (
        <div className="procedure-row" key={anamnesis.id}>
          <ClipboardList size={18} />
          <span className="procedure-info"><strong>{anamnesis.title}</strong><small>{anamnesis.versions.length} versões · atual v{anamnesis.versions.at(-1)?.version}</small></span>
          <div className="row-actions">
            {anamnesis.versions.slice(-3).reverse().map(({ version }) => (
              <button className="text-button" key={version} onClick={() => restore.mutate({ id: anamnesis.id, version })}>Restaurar v{version}</button>
            ))}
          </div>
        </div>
      ))}
      <AnamnesisDialog open={open} onOpenChange={setOpen} />
    </section>
  );
}
