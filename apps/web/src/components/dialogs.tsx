import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Field, FormDialog } from '@/components/FormDialog';
import { DatePicker, TimePicker } from '@/components/pickers';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { appointmentForm, followupForm, parseForm, paymentForm } from '@/lib/forms';
import { useCreateAppointment, useCreateFollowup, useCreatePayment } from '@/lib/queries';
import type { Followup, Combo, Patient, Plan, Procedure } from '@/lib/schemas';
import { currency, offerLabel } from '@/lib/format';

type Selection = { start: string; end: string };

// Sem `selection` (ex.: botão da visão geral) o horário é escolhido no próprio formulário.
export function AppointmentDialog({ open, selection, patientId, patients, followups, onClose }: { open: boolean; selection?: Selection | null; patientId?: string; patients: Patient[]; followups: Followup[]; onClose: () => void }) {
  const create = useCreateAppointment();
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Novo agendamento"
      submitLabel="Agendar"
      description={selection ? `${new Date(selection.start).toLocaleString('pt-BR')} – ${new Date(selection.end).toLocaleTimeString('pt-BR')}` : 'Escolha o paciente, o procedimento e o horário.'}
      onSubmit={(form) => {
        const { patientId: patient, followupItemId } = parseForm(appointmentForm, form);
        let startsAt = selection?.start, endsAt = selection?.end;
        if (!selection) {
          const date = String(form.get('date') ?? ''), start = String(form.get('start') ?? ''), end = String(form.get('end') ?? '');
          if (!date || !start || !end) throw new Error('Informe a data e os horários de início e fim.');
          startsAt = new Date(`${date}T${start}`).toISOString();
          endsAt = new Date(`${date}T${end}`).toISOString();
        }
        if (new Date(endsAt!) <= new Date(startsAt!)) throw new Error('O horário final deve ser depois do início.');
        return create.mutateAsync({ patientId: patient, followupItemIds: [followupItemId], startsAt: new Date(startsAt!).toISOString(), endsAt: new Date(endsAt!).toISOString(), status: 'planned' });
      }}
    >
      <AppointmentFields manual={!selection} lockedPatientId={patientId} patients={patients} followups={followups} />
    </FormDialog>
  );
}

function AppointmentFields({ manual, lockedPatientId, patients, followups }: { manual: boolean; lockedPatientId?: string; patients: Patient[]; followups: Followup[] }) {
  const [patientId, setPatientId] = useState(lockedPatientId ?? patients[0]?.id ?? '');
  const [date, setDate] = useState<string>(), [start, setStart] = useState<string>(), [end, setEnd] = useState<string>();
  // Só o que o paciente já contratou e ainda tem sessões a realizar; o catálogo não entra aqui.
  const mine = followups.filter((followup) => followup.patientId === patientId).map((followup) => ({ ...followup, items: followup.items.filter((item) => item.sessionsPerformed < item.sessionsTotal) })).filter((followup) => followup.items.length > 0);
  const pending = mine.filter((followup) => followup.blocked).flatMap((followup) => followup.anamneses.filter((form) => form.required && !form.answered).map((form) => form.title));
  return (
    <>
      <Field label="Paciente">
        {lockedPatientId ? (
          <>
            <input type="hidden" name="patientId" value={lockedPatientId} />
            <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm">{patients.find((patient) => patient.id === lockedPatientId)?.fullName}</div>
          </>
        ) : (
          <NativeSelect name="patientId" required value={patientId} onChange={(event) => setPatientId(event.target.value)}>
            {patients.map((patient) => <NativeSelectOption key={patient.id} value={patient.id}>{patient.fullName}</NativeSelectOption>)}
          </NativeSelect>
        )}
      </Field>
      <Field label="Procedimento">
        <NativeSelect name="followupItemId" required key={patientId}>
          {mine.length === 0 && <NativeSelectOption value="">Nenhum acompanhamento ativo para este paciente</NativeSelectOption>}
          {mine.flatMap((followup) => followup.items.map((item) => (
            <NativeSelectOption key={item.id} value={item.id} disabled={followup.blocked}>{`${followup.offerType === 'procedure' ? offerLabel('procedure', item.procedureName) : `${offerLabel(followup.offerType, followup.offerName)} · ${item.procedureName}`} (${item.sessionsPerformed}/${item.sessionsTotal})${followup.blocked ? ' — anamnese pendente' : ''}`}</NativeSelectOption>
          )))}
        </NativeSelect>
      </Field>
      {pending.length > 0 && <p role="alert" className="m-0 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Procedimentos bloqueados por anamnese pendente ({pending.join(", ")}). Conclua na ficha do paciente para liberar o agendamento.</p>}
      {manual && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Data"><DatePicker name="date" value={date} onChange={setDate} /></Field>
          <Field label="Início"><TimePicker name="start" value={start} onChange={setStart} /></Field>
          <Field label="Fim"><TimePicker name="end" value={end} onChange={setEnd} /></Field>
        </div>
      )}
    </>
  );
}

// Escolha uma oferta do catálogo (procedimento avulso, combo ou plano) para iniciar o acompanhamento do paciente.
export function NewFollowupDialog({ open, patientId, patients, procedures, combos, plans, onClose }: { open: boolean; patientId?: string; patients: Patient[]; procedures: Procedure[]; combos: Combo[]; plans: Plan[]; onClose: () => void }) {
  const create = useCreateFollowup();
  const navigate = useNavigate();
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Novo acompanhamento"
      description="Escolha o procedimento avulso, combo ou plano. Contratos e anamneses exigidos são gerados automaticamente."
      submitLabel="Iniciar acompanhamento"
      onSubmit={async (form) => {
        const { patientId: patient, offer } = parseForm(followupForm, form);
        const [offerType, offerId] = offer.split(':');
        await create.mutateAsync({ patientId: patient, offerType, offerId });
        if (!patientId) await navigate({ to: '/pacientes/$patientId', params: { patientId: patient } });
      }}
    >
      <OfferFields lockedPatientId={patientId} patients={patients} procedures={procedures} combos={combos} plans={plans} />
    </FormDialog>
  );
}

function OfferFields({ lockedPatientId, patients, procedures, combos, plans }: { lockedPatientId?: string; patients: Patient[]; procedures: Procedure[]; combos: Combo[]; plans: Plan[] }) {
  const [offer, setOffer] = useState('');
  const [type, id] = offer.split(':');
  const price = type === 'procedure' ? procedures.find((item) => item.id === id)?.priceCents : type === 'combo' ? (combos.find((item) => item.id === id)?.promotionalPriceCents ?? combos.find((item) => item.id === id)?.priceCents) : type === 'plan' ? plans.find((item) => item.id === id)?.priceCents : undefined;
  return (
    <>
      <Field label="Paciente">
        {lockedPatientId ? (
          <>
            <input type="hidden" name="patientId" value={lockedPatientId} />
            <div className="flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm">{patients.find((patient) => patient.id === lockedPatientId)?.fullName}</div>
          </>
        ) : (
          <NativeSelect name="patientId" required>
            {patients.map((patient) => <NativeSelectOption key={patient.id} value={patient.id}>{patient.fullName}</NativeSelectOption>)}
          </NativeSelect>
        )}
      </Field>
      <Field label="Oferta">
        <NativeSelect name="offer" required value={offer} onChange={(event) => setOffer(event.target.value)}>
          <NativeSelectOption value="">Selecione…</NativeSelectOption>
          {procedures.filter((procedure) => procedure.active !== false).map((procedure) => <NativeSelectOption key={procedure.id} value={`procedure:${procedure.id}`}>{offerLabel('procedure', procedure.name)}</NativeSelectOption>)}
          {combos.filter((combo) => combo.active !== false).map((combo) => <NativeSelectOption key={combo.id} value={`combo:${combo.id}`}>{offerLabel('combo', combo.name)}</NativeSelectOption>)}
          {plans.map((plan) => <NativeSelectOption key={plan.id} value={`plan:${plan.id}`}>{offerLabel('plan', plan.name)}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      {price !== undefined && <p className="m-0 text-sm text-muted-foreground">Valor: <strong className="text-foreground">{currency(price)}</strong></p>}
    </>
  );
}

export function PaymentDialog({ followup, onClose }: { followup: Followup | null; onClose: () => void }) {
  const create = useCreatePayment();
  return (
    <FormDialog
      open={!!followup}
      onOpenChange={(open) => !open && onClose()}
      title="Registrar pagamento"
      submitLabel="Registrar"
      description={followup && `${followup.offerName} · total ${currency(followup.priceCents)}`}
      onSubmit={(form) => {
        const { amount, ...data } = parseForm(paymentForm, form);
        return create.mutateAsync({ ...data, followupId: followup!.id, amountCents: amount });
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
