import { useState } from 'react';
import { Field } from '@/components/Field';
import { FormPage } from '@/components/FormPage';
import { SchemaEditor } from '@/components/SchemaEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { validateFormSchema } from '@/lib/fieldKinds';
import { parseForm, procedureForm } from '@/lib/forms';
import { useCreateProcedure, useUpdateProcedure } from '@/lib/queries';
import type { Procedure } from '@/lib/schemas';

const emptySchema: Record<string, unknown> = { type: 'object', properties: {} };

// Cadastro e edição de procedimento na mesma página; a edição preserva as versões dos campos da sessão.
export function ProcedureFormPage({ procedure }: { procedure?: Procedure }) {
  const create = useCreateProcedure(), update = useUpdateProcedure();
  const [schema, setSchema] = useState<Record<string, unknown>>((procedure?.sessionSchema as Record<string, unknown> | undefined) ?? emptySchema);
  const [requireNewAnamnesis, setRequireNewAnamnesis] = useState(procedure?.requireNewAnamnesis ?? false);
  const [active, setActive] = useState(procedure?.active ?? true);
  const [standalone, setStandalone] = useState(procedure?.standalone ?? true);
  const version = procedure?.versions?.at(-1)?.version;
  return (
    <FormPage
      backTo="/procedimentos"
      backLabel="Catálogo"
      title={procedure ? `Editar · ${procedure.name}` : 'Novo procedimento'}
      submitLabel={procedure ? 'Salvar alterações' : 'Salvar procedimento'}
      onSubmit={(form) => {
        const problem = validateFormSchema(schema, { requireFields: false });
        if (problem) throw new Error(problem);
        const { price, ...data } = parseForm(procedureForm, form);
        if (!standalone && data.baseSessions < 2) throw new Error('Procedimento que não pode ser avulso precisa de ao menos 2 sessões.');
        const body = { ...data, priceCents: price, sessionSchema: schema, requireNewAnamnesis, standalone };
        return procedure ? update.mutateAsync({ ...body, id: procedure.id, active }) : create.mutateAsync(body);
      }}
      below={(
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
      )}
    >
      <Field label="Nome" name="name" required autoFocus defaultValue={procedure?.name} className="max-w-xl" />
      <Field label="Descrição" name="description" defaultValue={procedure?.description ?? ''} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Sessões base" name="baseSessions" type="number" min={standalone ? 1 : 2} defaultValue={procedure?.baseSessions ?? 1} required />
        <Field label="Duração por sessão (minutos)" name="durationMinutes" type="number" min="5" step="5" defaultValue={procedure?.durationMinutes ?? 60} required />
        <Field label="Preço por sessão R$" name="price" type="number" min="0" step="0.01" defaultValue={procedure ? (procedure.priceCents / 100).toFixed(2) : '0'} required />
      </div>
      <Label className="cursor-pointer">
        <Checkbox checked={standalone} onCheckedChange={(value) => setStandalone(value === true)} />
        <span>Pode ser realizado avulso <span className="text-xs font-normal text-muted-foreground">— uma única sessão, sem acompanhamento. Desmarque se ele só faz sentido em combo ou plano (várias sessões).</span></span>
      </Label>
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
