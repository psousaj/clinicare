import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { AnamnesisFormPage } from '@/components/AnamnesisFormPage';
import { QueryError } from '@/components/QueryState';
import { VersionsButton } from '@/components/VersionsDialog';
import { anamnesesQuery, useUpdateAnamnesis } from '@/lib/queries';
import type { Anamnesis } from '@/lib/schemas';
import { originLabel, sameSchema } from '@/lib/versions';

export const Route = createFileRoute('/_app/formularios-anamnese/$anamnesisId')({ component: EditAnamnesis });

function EditAnamnesis() {
  const { anamnesisId } = Route.useParams();
  const anamneses = useQuery(anamnesesQuery);
  const anamnesis = anamneses.data?.find((candidate) => candidate.id === anamnesisId);
  if (anamnesis) return <Editor key={anamnesis.versions.at(-1)!.version} anamnesis={anamnesis} />;
  return (
    <section className="panel">
      <QueryError query={anamneses} />
      {anamneses.isSuccess ? <p className="section-note" role="alert">Formulário de anamnese não encontrado.</p> : <p className="section-note">Carregando…</p>}
    </section>
  );
}

function Editor({ anamnesis }: { anamnesis: Anamnesis }) {
  const navigate = useNavigate();
  const update = useUpdateAnamnesis();
  const current = anamnesis.versions.at(-1)!;
  return (
    <AnamnesisFormPage
      heading={`Editar · ${anamnesis.title}`}
      submitLabel="Salvar alterações"
       initialTitle={anamnesis.title}
       initialDescription={anamnesis.description}
      initialSchema={current.schema as Record<string, unknown>}
      initialValidityMonths={anamnesis.validityMonths}
      saving={update.isPending}
      actions={<VersionsButton anamnesis={anamnesis} />}
      notice={(
        <p className="m-0 max-w-2xl rounded-md bg-primary/5 p-3 text-sm">
          Editando a <strong>v{current.version}</strong> ({originLabel(current).toLowerCase()}). Alterações nos campos geram a <strong>v{current.version + 1}</strong>; as versões anteriores e as respostas já enviadas não mudam.
        </p>
      )}
       onSave={async ({ title, description, schema, validityMonths }) => {
         const settingsChanged = title !== anamnesis.title || description !== (anamnesis.description ?? null) || validityMonths !== anamnesis.validityMonths;
         const schemaChanged = !sameSchema(schema, current.schema as Record<string, unknown>);
         if (!settingsChanged && !schemaChanged) return toast.info('Nenhuma alteração para salvar.');
         await update.mutateAsync({ id: anamnesis.id, ...(settingsChanged && { title, description, validityMonths }), schema: schemaChanged ? schema : undefined });
        await navigate({ to: '/formularios-anamnese' });
      }}
    />
  );
}
