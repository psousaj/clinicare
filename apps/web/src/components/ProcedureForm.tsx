import { useState } from 'react';
import { Field } from '@/components/Field';
import { FormPage } from '@/components/FormPage';
import { AnamnesisPicker } from '@/components/AnamnesisPicker';
import { SchemaEditor } from '@/components/SchemaEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { validateFormSchema } from '@/lib/fieldKinds';
import { toggleId } from '@/lib/utils';
import { parseForm, procedureForm } from '@/lib/forms';
import { anamnesesQuery, useCreateProcedure, useSaveProcedureAnamneses, useUpdateProcedure } from '@/lib/queries';
import { useQuery } from '@tanstack/react-query';
import type { Procedure } from '@/lib/schemas';

const emptySchema: Record<string, unknown> = { type: 'object', properties: {} };

// Cadastro e edição de procedimento na mesma página; a edição preserva as versões dos campos da sessão.
export function ProcedureFormPage({ procedure }: { procedure?: Procedure }) {
  const create = useCreateProcedure(), update = useUpdateProcedure(), saveAnamneses = useSaveProcedureAnamneses();
  const forms = useQuery(anamnesesQuery).data ?? [];
  const [schema, setSchema] = useState<Record<string, unknown>>((procedure?.sessionSchema as Record<string, unknown> | undefined) ?? emptySchema);
  const [requireNewAnamnesis, setRequireNewAnamnesis] = useState(procedure?.requireNewAnamnesis ?? false);
  const [active, setActive] = useState(procedure?.active ?? true);
  const [anamnesisIds, setAnamnesisIds] = useState<string[]>(procedure?.anamnesisIds ?? []);
  const version = procedure?.versions?.at(-1)?.version;
  return (
    <FormPage
      backTo="/procedimentos"
      backLabel="Catálogo"
      title={procedure ? `Editar · ${procedure.name}` : 'Novo procedimento'}
      submitLabel={procedure ? 'Salvar alterações' : 'Salvar procedimento'}
      onSubmit={async (form) => {
        const problem = validateFormSchema(schema, { requireFields: false });
        if (problem) throw new Error(problem);
        const { price, ...data } = parseForm(procedureForm, form);
        const body = { ...data, priceCents: price, sessionSchema: schema, requireNewAnamnesis };
        const saved = procedure ? await update.mutateAsync({ ...body, id: procedure.id, active }) : await create.mutateAsync(body);
        const targetId = procedure?.id ?? (saved as { id: string }).id;
        if ([...anamnesisIds].sort().join() !== [...(procedure?.anamnesisIds ?? [])].sort().join()) await saveAnamneses.mutateAsync({ id: targetId, anamnesisIds });
      }}
      below={(
        <>
          <section className="panel grid gap-3">
            <div>
              <div className="section-kicker">ANAMNESES</div>
              <h3 className="m-0 text-sm font-semibold">Formulários exigidos</h3>
              <p className="m-0 text-xs text-muted-foreground">Vinculados neste procedimento; valem no avulso e em todo combo, plano ou evento que o incluir.</p>
            </div>
            <AnamnesisPicker forms={forms} pickedIds={anamnesisIds} onToggle={(id, on) => setAnamnesisIds((list) => toggleId(list, id, on))} />
          </section>
          <section className="panel grid gap-3">
            <div>
              <div className="section-kicker">SESSÃO</div>
              <h3 className="m-0 text-sm font-semibold">Campos da sessão</h3>
              <p className="m-0 text-xs text-muted-foreground">
                Informações registradas a cada sessão realizada deste procedimento.
                {procedure && ` Ao alterar os campos, uma nova versão (v${(version ?? 1) + 1}) é criada; atendimentos já registrados mantêm a versão em que foram feitos.`}
              </p>
            </div>
            <SchemaEditor value={schema} onChange={setSchema} />
          </section>
        </>
      )}
    >
      <Field label="Nome" name="name" required autoFocus defaultValue={procedure?.name} className="max-w-xl" />
      <Field label="Descrição" name="description" defaultValue={procedure?.description ?? ''} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Duração por sessão (minutos)" name="durationMinutes" type="number" min="5" step="5" defaultValue={procedure?.durationMinutes ?? 60} required />
        <Field label="Preço por sessão R$" name="price" type="number" min="0" step="0.01" defaultValue={procedure ? (procedure.priceCents / 100).toFixed(2) : '0'} required />
      </div>
      <Field label="Sessões base (mínimo)" name="baseSessions" type="number" min="1" placeholder="Opcional; vazio = avulso permitido" defaultValue={procedure?.baseSessions ?? (procedure?.standalone === false ? 2 : '')} />
      <p className="-mt-3 text-xs text-muted-foreground">Sem valor, o procedimento pode ser avulso e combos/planos começam em 1 sessão. Mínimo de 2 ou mais bloqueia avulso e define a quantidade inicial nos combos e planos.</p>
      <Label className="cursor-pointer">
        <Checkbox checked={requireNewAnamnesis} onCheckedChange={(value) => setRequireNewAnamnesis(value === true)} />
        Exigir nova anamnese a cada acompanhamento, mesmo que a última ainda esteja válida
      </Label>
      {procedure && (
        <Label className="cursor-pointer">
          <Checkbox checked={active} onCheckedChange={(value) => setActive(value === true)} />
          Ativo — disponível para novos acompanhamentos (acompanhamentos já iniciados não mudam)
        </Label>
      )}
    </FormPage>
  );
}
