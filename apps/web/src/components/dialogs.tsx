import { useState } from 'react';
import { Field, FormDialog } from '@/components/FormDialog';
import { SchemaEditor } from '@/components/SchemaForm';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { appointmentForm, anamnesisForm, contractForm, packageForm, parseForm, patientForm, paymentForm, procedureForm } from '@/lib/forms';
import { useCreateAnamnesis, useCreateAppointment, useCreateContract, useCreatePackage, useCreatePatient, useCreatePayment, useCreateProcedure, useCreateSession } from '@/lib/queries';
import type { Patient, Plan, PlanItem, Procedure } from '@/lib/schemas';
import { currency } from '@/lib/format';

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void };
type JsonSchema = Record<string, unknown>;
const emptySchema: JsonSchema = { type: 'object', properties: {} };

export function PatientDialog(props: DialogProps) {
  const create = useCreatePatient();
  return (
    <FormDialog {...props} kicker="NOVO CADASTRO" title="Cadastrar paciente" submitLabel="Salvar paciente" onSubmit={(form) => create.mutateAsync(parseForm(patientForm, form))}>
      <Field label="Nome completo" name="fullName" required autoFocus />
      <Field label="Telefone" name="phone" />
      <Field label="E-mail" name="email" type="email" />
    </FormDialog>
  );
}

export function ProcedureDialog(props: DialogProps) {
  const create = useCreateProcedure();
  const [schema, setSchema] = useState<JsonSchema>(emptySchema);
  return (
    <FormDialog
      {...props}
      wide
      kicker="CATÁLOGO DA CLÍNICA"
      title="Novo procedimento"
      submitLabel="Salvar procedimento"
      onSubmit={async (form) => {
        const { price, ...data } = parseForm(procedureForm, form);
        await create.mutateAsync({ ...data, priceCents: price, sessionSchema: schema });
        setSchema(emptySchema);
      }}
    >
      <Field label="Nome" name="name" required autoFocus />
      <Field label="Descrição" name="description" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Sessões base" name="baseSessions" type="number" min="1" defaultValue="1" required />
        <Field label="Duração (minutos)" name="durationMinutes" type="number" min="0" placeholder="Opcional" />
        <Field label="Preço padrão R$" name="price" type="number" min="0" step="0.01" defaultValue="0" required />
      </div>
      <SchemaEditor value={schema} onChange={setSchema} />
    </FormDialog>
  );
}

export function AnamnesisDialog(props: DialogProps) {
  const create = useCreateAnamnesis();
  const [schema, setSchema] = useState<JsonSchema>(emptySchema);
  return (
    <FormDialog
      {...props}
      wide
      kicker="JSON SCHEMA FORM"
      title="Nova anamnese"
      submitLabel="Salvar anamnese"
      onSubmit={async (form) => {
        await create.mutateAsync({ ...parseForm(anamnesisForm, form), schema });
        setSchema(emptySchema);
      }}
    >
      <Field label="Nome do formulário" name="title" required autoFocus />
      <SchemaEditor value={schema} onChange={setSchema} />
    </FormDialog>
  );
}

export function ContractDialog(props: DialogProps) {
  const create = useCreateContract();
  return (
    <FormDialog {...props} title="Novo contrato" submitLabel="Salvar versão 1" onSubmit={(form) => create.mutateAsync(parseForm(contractForm, form))}>
      <Field label="Nome do documento" name="title" required autoFocus />
      <Field label="Aplicação">
        <NativeSelect name="kind">
          <NativeSelectOption value="standard">Padrão de serviço</NativeSelectOption>
          <NativeSelectOption value="procedure">Específico de procedimento</NativeSelectOption>
          <NativeSelectOption value="package">Específico de pacote</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field label="Conteúdo do documento">
        <Textarea name="content" rows={8} placeholder="Escreva o conteúdo do modelo. Importação DOCX fica disponível ao configurar R2." />
      </Field>
    </FormDialog>
  );
}

export function PackageDialog({ procedures, ...props }: DialogProps & { procedures: Procedure[] }) {
  const create = useCreatePackage();
  return (
    <FormDialog
      {...props}
      title="Novo pacote"
      submitLabel="Salvar pacote"
      onSubmit={(form) => {
        const { price, promo, procedureId, sessionsOverride, ...data } = parseForm(packageForm, form);
        return create.mutateAsync({ ...data, priceCents: price, promotionalPriceCents: promo, items: [{ procedureId, sessionsOverride }] });
      }}
    >
      <Field label="Nome" name="name" required autoFocus />
      <Field label="Procedimento">
        <NativeSelect name="procedureId" required>
          {procedures.map((procedure) => <NativeSelectOption key={procedure.id} value={procedure.id}>{procedure.name}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      <Field label="Sessões (opcional; substitui padrão)" name="sessionsOverride" type="number" min="1" />
      <Field label="Preço padrão R$" name="price" type="number" min="0" step="0.01" required />
      <Field label="Preço promocional R$" name="promo" type="number" min="0" step="0.01" />
      <Field label="Válido até" name="validUntil" type="date" />
    </FormDialog>
  );
}

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

type SchemaProperty = { title?: string; type?: string };

export function SessionDialog({ item, onClose }: { item: PlanItem | null; onClose: () => void }) {
  const create = useCreateSession();
  const properties = (item?.sessionSchema?.properties ?? {}) as Record<string, SchemaProperty>;
  const required = (item?.sessionSchema?.required ?? []) as string[];
  return (
    <FormDialog
      open={!!item}
      onOpenChange={(open) => !open && onClose()}
      title="Registrar sessão realizada"
      submitLabel="Salvar sessão"
      description={item?.procedureName}
      onSubmit={(form) => {
        const data: Record<string, unknown> = {};
        for (const [key, value] of form.entries()) if (key.startsWith('field:')) data[key.slice(6)] = value;
        return create.mutateAsync({ planItemId: item!.id, appointmentId: null, data, notes: form.get('notes') });
      }}
    >
      {Object.entries(properties).map(([key, schema]) => (
        <Field key={key} label={schema.title ?? key} name={`field:${key}`} type={schema.type === 'number' ? 'number' : 'text'} required={required.includes(key)} />
      ))}
      <Field label="Observações">
        <Textarea name="notes" rows={3} />
      </Field>
    </FormDialog>
  );
}
