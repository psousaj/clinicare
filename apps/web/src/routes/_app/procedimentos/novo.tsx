import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Field } from '@/components/Field';
import { FormPage } from '@/components/FormPage';
import { SchemaEditor } from '@/components/SchemaEditor';
import { validateFormSchema } from '@/lib/fieldKinds';
import { parseForm, procedureForm } from '@/lib/forms';
import { useCreateProcedure } from '@/lib/queries';

export const Route = createFileRoute('/_app/procedimentos/novo')({ component: NewProcedure });

const emptySchema: Record<string, unknown> = { type: 'object', properties: {} };

function NewProcedure() {
  const create = useCreateProcedure();
  const [schema, setSchema] = useState(emptySchema);
  return (
    <FormPage
      backTo="/procedimentos"
      backLabel="Procedimentos"
      title="Novo procedimento"
      submitLabel="Salvar procedimento"
      onSubmit={(form) => {
        const problem = validateFormSchema(schema, { requireFields: false });
        if (problem) throw new Error(problem);
        const { price, ...data } = parseForm(procedureForm, form);
        return create.mutateAsync({ ...data, priceCents: price, sessionSchema: schema });
      }}
      below={(
        <section className="grid gap-3">
          <div>
            <h3 className="m-0 text-sm font-semibold">Campos da sessão</h3>
            <p className="m-0 text-xs text-muted-foreground">Informações registradas a cada sessão realizada deste procedimento.</p>
          </div>
          <SchemaEditor value={schema} onChange={setSchema} />
        </section>
      )}
    >
      <Field label="Nome" name="name" required autoFocus className="max-w-xl" />
      <Field label="Descrição" name="description" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Sessões base" name="baseSessions" type="number" min="1" defaultValue="1" required />
        <Field label="Duração (minutos)" name="durationMinutes" type="number" min="0" placeholder="Opcional" />
        <Field label="Preço padrão R$" name="price" type="number" min="0" step="0.01" defaultValue="0" required />
      </div>
    </FormPage>
  );
}
