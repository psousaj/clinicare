import { createFileRoute } from '@tanstack/react-router';
import { Field } from '@/components/Field';
import { CpfField } from '@/components/CpfField';
import { FormPage } from '@/components/FormPage';
import { Textarea } from '@/components/ui/textarea';
import { parseForm, patientForm } from '@/lib/forms';
import { useCreatePatient } from '@/lib/queries';

export const Route = createFileRoute('/_app/pacientes/novo')({ component: NewPatient });

function NewPatient() {
  const create = useCreatePatient();
  return (
    <FormPage backTo="/pacientes" backLabel="Pacientes" title="Novo paciente" submitLabel="Salvar paciente" narrow onSubmit={(form) => create.mutateAsync(parseForm(patientForm, form))}>
      <Field label="Nome completo" name="fullName" required autoFocus />
      <Field label="Data de nascimento" name="birthDate" type="date" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefone" name="phone" type="tel" />
        <Field label="E-mail" name="email" type="email" />
        <CpfField />
      </div>
      <Field label="Observações">
        <Textarea name="notes" rows={4} />
      </Field>
    </FormPage>
  );
}
