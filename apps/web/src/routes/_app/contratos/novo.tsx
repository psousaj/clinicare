import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ContractFormPage } from '@/components/ContractFormPage';
import { useCreateContract } from '@/lib/queries';

export const Route = createFileRoute('/_app/contratos/novo')({ component: NewContract });

function NewContract() {
  const navigate = useNavigate();
  const create = useCreateContract();
  return (
    <ContractFormPage
      heading="Novo contrato"
      submitLabel="Salvar contrato"
      saving={create.isPending}
      onSave={async (data) => {
        await create.mutateAsync(data);
        await navigate({ to: '/contratos' });
      }}
    />
  );
}
