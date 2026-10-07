import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AnamnesisFormPage } from '@/components/AnamnesisFormPage';
import { useCreateAnamnesis } from '@/lib/queries';

export const Route = createFileRoute('/_app/formularios-anamnese/nova')({ component: NewAnamnesis });

function NewAnamnesis() {
  const navigate = useNavigate();
  const create = useCreateAnamnesis();
  return (
    <AnamnesisFormPage
      heading="Novo formulário de anamnese"
      submitLabel="Salvar formulário"
      saving={create.isPending}
       onSave={async (data) => {
        await create.mutateAsync(data);
        await navigate({ to: '/formularios-anamnese' });
      }}
    />
  );
}
