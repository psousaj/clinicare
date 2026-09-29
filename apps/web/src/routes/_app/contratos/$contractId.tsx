import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { ContractFormPage } from '@/components/ContractFormPage';
import { QueryError } from '@/components/QueryState';
import { ContractVersionsButton } from '@/components/VersionsDialog';
import { contractsQuery, useUpdateContract } from '@/lib/queries';
import type { Contract } from '@/lib/schemas';
import { originLabel } from '@/lib/versions';

export const Route = createFileRoute('/_app/contratos/$contractId')({ component: EditContract });

function EditContract() {
  const { contractId } = Route.useParams();
  const contracts = useQuery(contractsQuery);
  const contract = contracts.data?.find((candidate) => candidate.id === contractId);
  if (contract) return <Editor key={contract.versions.at(-1)!.version} contract={contract} />;
  return (
    <section className="panel">
      <QueryError query={contracts} />
      {contracts.isSuccess ? <p className="section-note" role="alert">Contrato não encontrado.</p> : <p className="section-note">Carregando…</p>}
    </section>
  );
}

function Editor({ contract }: { contract: Contract }) {
  const navigate = useNavigate();
  const update = useUpdateContract();
  const current = contract.versions.at(-1)!;
  return (
    <ContractFormPage
      heading={`Editar · ${contract.title}`}
      submitLabel="Salvar alterações"
      initial={{ title: contract.title, kind: contract.kind, procedureId: contract.procedureId, comboId: contract.comboId, content: current.content ?? '' }}
      saving={update.isPending}
      actions={<ContractVersionsButton contract={contract} />}
      notice={(
        <p className="m-0 max-w-2xl rounded-md bg-primary/5 p-3 text-sm">
          Editando a <strong>v{current.version}</strong> ({originLabel(current).toLowerCase()}). Alterações no texto geram a <strong>v{current.version + 1}</strong>; as versões anteriores e os acompanhamentos que já usam este contrato não mudam.
        </p>
      )}
      onSave={async ({ title, kind, procedureId, comboId, content }) => {
        const settingsChanged = title !== contract.title || kind !== contract.kind || procedureId !== (contract.procedureId ?? null) || comboId !== (contract.comboId ?? null);
        const contentChanged = content.trim() !== (current.content ?? '').trim();
        if (!settingsChanged && !contentChanged) return toast.info('Nenhuma alteração para salvar.');
        await update.mutateAsync({ id: contract.id, ...(settingsChanged && { settings: { title, kind, procedureId, comboId } }), content: contentChanged ? content : undefined });
        await navigate({ to: '/contratos' });
      }}
    />
  );
}
