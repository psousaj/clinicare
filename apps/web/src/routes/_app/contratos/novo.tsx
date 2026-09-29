import { createFileRoute } from '@tanstack/react-router';
import { Field } from '@/components/Field';
import { FormPage } from '@/components/FormPage';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { contractForm, parseForm } from '@/lib/forms';
import { useCreateContract } from '@/lib/queries';

export const Route = createFileRoute('/_app/contratos/novo')({ component: NewContract });

function NewContract() {
  const create = useCreateContract();
  return (
    <FormPage backTo="/contratos" backLabel="Contratos" title="Novo contrato" submitLabel="Salvar versão 1" onSubmit={(form) => create.mutateAsync(parseForm(contractForm, form))}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do documento" name="title" required autoFocus />
        <Field label="Aplicação">
          <NativeSelect name="kind">
            <NativeSelectOption value="standard">Padrão de serviço</NativeSelectOption>
            <NativeSelectOption value="procedure">Específico de procedimento</NativeSelectOption>
            <NativeSelectOption value="combo">Específico de combo</NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Conteúdo do documento">
        <Textarea name="content" rows={16} placeholder="Escreva o conteúdo do modelo. Importação DOCX fica disponível ao configurar R2." />
      </Field>
    </FormPage>
  );
}
