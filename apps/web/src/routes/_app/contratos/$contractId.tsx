import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ContractFormPage } from '@/components/ContractFormPage';
import { QueryError } from '@/components/QueryState';
import { ContractVersionsButton } from '@/components/VersionsDialog';
import { contractsQuery, useUpdateContract } from '@/lib/queries';

export const Route = createFileRoute('/_app/contratos/$contractId')({ component: EditContract });

function EditContract() {
  const { contractId } = Route.useParams();
  const contracts = useQuery(contractsQuery);
  const contract = contracts.data?.find((candidate) => candidate.id === contractId);
  if (contract) return <Editor key={`${contract.id}-v${contract.currentVersion}`} contractId={contract.id} />;
  return (
    <section className="panel">
      <QueryError query={contracts} />
      {contracts.isSuccess ? <p className="section-note" role="alert">Contrato não encontrado.</p> : <p className="section-note">Carregando…</p>}
    </section>
  );
}

function Editor({ contractId }: { contractId: string }) {
  const contracts = useQuery(contractsQuery);
  const contract = contracts.data?.find((candidate) => candidate.id === contractId)!;
  const update = useUpdateContract();
  const current = contract.versions.at(-1);
  return (
    <ContractFormPage
      heading={`Editar · ${contract.title}`}
      submitLabel="Salvar alterações"
      initial={{ title: contract.title, kind: contract.kind, procedureId: contract.procedureId, comboId: contract.comboId }}
      saving={update.isPending}
      contract={contract}
      actions={<ContractVersionsButton contract={contract} />}
      notice={(
        <p className="m-0 max-w-2xl rounded-md bg-primary/5 p-3 text-sm">
          {current ? <>Versão atual <strong>v{current.version}</strong> (imutável). Publicar o draft gera a <strong>v{contract.currentVersion + 1}</strong>; acompanhamentos que já usam este contrato não mudam.</> : <>Nenhuma versão publicada. Salve o draft DOCX e publique a <strong>v1</strong>.</>}
        </p>
      )}
      onSave={async ({ title, kind, procedureId, comboId }) => {
        await update.mutateAsync({ id: contract.id, settings: { title, kind, procedureId, comboId } });
      }}
    />
  );
}
