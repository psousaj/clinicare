import { Field, FormDialog } from '@/components/FormDialog';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { appointmentForm, parseForm, paymentForm } from '@/lib/forms';
import { useCreateAppointment, useCreatePayment } from '@/lib/queries';
import type { Patient, Plan } from '@/lib/schemas';
import { currency } from '@/lib/format';

export function AppointmentDialog({ selection, patients, plans, onClose }: { selection: { start: string; end: string } | null; patients: Patient[]; plans: Plan[]; onClose: () => void }) {
  const create = useCreateAppointment();
  return (
    <FormDialog
      open={!!selection}
      onOpenChange={(open) => !open && onClose()}
      title="Novo agendamento"
      submitLabel="Agendar"
      description={selection && `${new Date(selection.start).toLocaleString('pt-BR')} – ${new Date(selection.end).toLocaleTimeString('pt-BR')}`}
      onSubmit={(form) => {
        const { patientId, planItemId } = parseForm(appointmentForm, form);
        return create.mutateAsync({ patientId, planItemIds: [planItemId], startsAt: new Date(selection!.start).toISOString(), endsAt: new Date(selection!.end).toISOString(), status: 'planned' });
      }}
    >
      <Field label="Paciente">
        <NativeSelect name="patientId" required>
          {patients.map((patient) => <NativeSelectOption key={patient.id} value={patient.id}>{patient.fullName}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Procedimento contratado">
        <NativeSelect name="planItemId" required>
          {plans.flatMap((plan) => plan.items.map((item) => <NativeSelectOption key={item.id} value={item.id}>{patients.find((patient) => patient.id === plan.patientId)?.fullName} · {item.procedureName}</NativeSelectOption>))}
        </NativeSelect>
      </Field>
    </FormDialog>
  );
}

export function PaymentDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const create = useCreatePayment();
  return (
    <FormDialog
      open={!!plan}
      onOpenChange={(open) => !open && onClose()}
      title="Registrar pagamento"
      submitLabel="Registrar"
      description={plan && `${plan.offerName} · total ${currency(plan.priceCents)}`}
      onSubmit={(form) => {
        const { amount, ...data } = parseForm(paymentForm, form);
        return create.mutateAsync({ ...data, planId: plan!.id, amountCents: amount });
      }}
    >
      <Field label="Valor recebido R$" name="amount" type="number" step="0.01" min="0.01" required />
      <Field label="Forma de pagamento">
        <NativeSelect name="method">
          <NativeSelectOption value="pix">PIX</NativeSelectOption>
          <NativeSelectOption value="cash">Dinheiro</NativeSelectOption>
          <NativeSelectOption value="credit_card">Cartão de crédito</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field label="Parcelas" name="installments" type="number" min="1" defaultValue="1" />
    </FormDialog>
  );
}
