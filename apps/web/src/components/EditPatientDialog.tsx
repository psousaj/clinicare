import { FormDialog, Field } from '@/components/FormDialog';
import { CpfField } from '@/components/CpfField';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdatePatient } from '@/lib/queries';
import type { Patient } from '@/lib/schemas';

export function EditPatientDialog({ open, onOpenChange, patient }: { open: boolean; onOpenChange: (open: boolean) => void; patient: Patient }) {
  const update = useUpdatePatient(patient.id);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editar paciente"
      description="Atualize os dados cadastrais do paciente."
      submitLabel="Salvar alterações"
      onSubmit={(form) => update.mutateAsync({
        fullName: String(form.get('fullName') ?? ''),
        email: String(form.get('email') ?? '').trim() || null,
        phone: String(form.get('phone') ?? '').trim() || null,
        cpf: String(form.get('cpf') ?? '').trim() || null,
        birthDate: String(form.get('birthDate') ?? '') || null,
        notes: String(form.get('notes') ?? '').trim() || null,
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" name="fullName" required minLength={2} defaultValue={patient.fullName} />
        <Field label="Data de nascimento" name="birthDate" type="date" defaultValue={patient.birthDate ?? ''} />
        <Field label="E-mail" name="email" type="email" defaultValue={patient.email ?? ''} />
        <Field label="Telefone" name="phone" type="tel" defaultValue={patient.phone ?? ''} />
        <CpfField defaultValue={patient.cpf ?? ''} />
        <Label className="flex-col items-stretch gap-1.5 sm:col-span-2">
          Observações
          <Textarea name="notes" defaultValue={patient.notes ?? ''} />
        </Label>
      </div>
    </FormDialog>
  );
}
