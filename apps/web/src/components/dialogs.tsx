import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormDialog } from '@/components/FormDialog';
import { DatePicker, TimePicker } from '@/components/pickers';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { appointmentForm, followupForm, parseForm, paymentForm } from '@/lib/forms';
import { useCreateAppointment, useCreateFollowup, useCreatePayment, useDeleteAppointment, useUpdateAppointment } from '@/lib/queries';
import type { Appointment, Followup, Combo, Patient, Plan, Procedure } from '@/lib/schemas';
import { currency, offerLabel } from '@/lib/format';

type Selection = { start: string; end: string };
type PlannedItem = { followupItemId?: string; procedureId?: string; quantity: number };

const minutesBetween = (start: string, end: string) => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);

// Sem `selection` (ex.: botão da visão geral) o horário é escolhido no próprio formulário.
const localDate = (value: string) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const localTime = (value: string) => { const date = new Date(value); return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; };

export function AppointmentDialog({ open, selection, appointment, patientId, patients, followups, procedures, onClose }: { open: boolean; selection?: Selection | null; appointment?: Appointment | null; patientId?: string; patients: Patient[]; followups: Followup[]; procedures: Procedure[]; onClose: () => void }) {
  const create = useCreateAppointment(), update = useUpdateAppointment(), remove = useDeleteAppointment();
  const [date, setDate] = useState<string>(), [start, setStart] = useState<string>(), [end, setEnd] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setConfirmDelete(false);
    if (!appointment) { setDate(undefined); setStart(undefined); setEnd(undefined); return; }
    setDate(localDate(appointment.startsAt)); setStart(localTime(appointment.startsAt)); setEnd(localTime(appointment.endsAt));
  }, [appointment?.id]);
  const description = appointment
    ? `${new Date(appointment.startsAt).toLocaleString('pt-BR')} – ${new Date(appointment.endsAt).toLocaleTimeString('pt-BR')}`
    : selection ? `${new Date(selection.start).toLocaleString('pt-BR')} – ${new Date(selection.end).toLocaleTimeString('pt-BR')}` : 'Escolha o paciente, o horário e o que será realizado na sessão.';
  const actions = appointment ? (
    confirmDelete ? <><Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>Manter</Button><Button type="button" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutateAsync(appointment.id).then(onClose)}>Confirmar exclusão</Button></>
      : <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>Excluir agendamento</Button>
  ) : undefined;
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={appointment ? 'Editar agendamento' : 'Novo agendamento'}
      wide
      submitLabel={appointment ? 'Salvar alterações' : 'Agendar'}
      description={description}
      actions={actions}
      onSubmit={(form) => {
        if (appointment) {
          if (!date || !start || !end) throw new Error('Informe a data e os horários de início e fim.');
          const startsAt = new Date(`${date}T${start}`).toISOString(), endsAt = new Date(`${date}T${end}`).toISOString();
          if (new Date(endsAt) <= new Date(startsAt)) throw new Error('O horário final deve ser depois do início.');
          return update.mutateAsync({ id: appointment.id, startsAt, endsAt });
        }
        const { patientId: patient } = parseForm(appointmentForm, form);
        const items = JSON.parse(String(form.get('items') ?? '[]')) as PlannedItem[];
        let startsAt = selection?.start, endsAt = selection?.end;
        if (!selection) {
          const date = String(form.get('date') ?? ''), start = String(form.get('start') ?? ''), end = String(form.get('end') ?? '');
          if (!date || !start || !end) throw new Error('Informe a data e os horários de início e fim.');
          startsAt = new Date(`${date}T${start}`).toISOString();
          endsAt = new Date(`${date}T${end}`).toISOString();
        }
        if (new Date(endsAt!) <= new Date(startsAt!)) throw new Error('O horário final deve ser depois do início.');
        if (!items.length) throw new Error('Escolha ao menos um procedimento para a sessão.');
        return create.mutateAsync({ patientId: patient, items, startsAt: new Date(startsAt!).toISOString(), endsAt: new Date(endsAt!).toISOString(), status: 'planned' });
      }}
    >
      {appointment ? (
        <>
          <Field label="Paciente"><div className="flex h-9 items-center rounded-lg border border-border bg-muted px-3 text-sm">{patients.find((patient) => patient.id === appointment.patientId)?.fullName ?? 'Paciente'}</div></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Data"><DatePicker value={date} onChange={setDate} /></Field>
            <Field label="Início"><TimePicker value={start} onChange={setStart} /></Field>
            <Field label="Fim"><TimePicker value={end} onChange={setEnd} /></Field>
          </div>
          <div className="rounded-lg border border-border p-3"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Procedimentos agendados</div><ul className="m-0 grid gap-1 pl-5 text-sm">{appointment.items.map((item) => <li key={item.followupItemId ?? item.procedureId}>{item.procedureName}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</li>)}</ul></div>
        </>
      ) : <AppointmentFields selection={selection} lockedPatientId={patientId} patients={patients} followups={followups} procedures={procedures} />}
    </FormDialog>
  );
}

// Monta a sessão: procedimentos avulsos e sessões dos acompanhamentos do paciente, limitados pelos minutos do horário.
function AppointmentFields({ selection, lockedPatientId, patients, followups, procedures }: { selection?: Selection | null; lockedPatientId?: string; patients: Patient[]; followups: Followup[]; procedures: Procedure[] }) {
  const [patientId, setPatientId] = useState(lockedPatientId ?? patients[0]?.id ?? '');
  const [date, setDate] = useState<string>(), [start, setStart] = useState<string>(), [end, setEnd] = useState<string>();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const capacity = selection ? minutesBetween(selection.start, selection.end) : date && start && end ? minutesBetween(`${date}T${start}`, `${date}T${end}`) : 0;
  const minutesOf = (procedureId?: string | null) => procedures.find((procedure) => procedure.id === procedureId)?.durationMinutes ?? 60;
  const minutesOfItem = (item: { procedureId?: string | null; durationMinutes?: number | null }) => item.durationMinutes ?? minutesOf(item.procedureId);
  const patientFollowups = followups.filter((followup) => followup.patientId === patientId);
  const blockedStandalone = new Set(patientFollowups.filter((followup) => followup.offerType === 'procedure' && followup.blocked).flatMap((followup) => followup.items.map((item) => item.procedureId)));
  const mine = patientFollowups.filter((followup) => followup.offerType !== 'procedure').map((followup) => ({ ...followup, items: followup.items.filter((item) => item.sessionsPerformed < item.sessionsTotal) })).filter((followup) => followup.items.length > 0);
  const avulsos = procedures.filter((procedure) => procedure.active !== false && procedure.standalone !== false);
  const pending = patientFollowups.filter((followup) => followup.blocked).flatMap((followup) => followup.anamneses.filter((form) => form.required && !form.answered).map((form) => form.title));
  const rows = [
    ...avulsos.map((procedure) => ({ key: `p:${procedure.id}`, minutes: minutesOf(procedure.id), max: 1 })),
    ...mine.flatMap((followup) => followup.items.map((item) => ({ key: `f:${item.id}`, minutes: minutesOfItem(item), max: item.sessionsTotal - item.sessionsPerformed }))),
  ];
  const used = rows.reduce((total, row) => total + (quantities[row.key] ?? 0) * row.minutes, 0);
  const left = capacity - used;
  const change = (key: string, quantity: number) => setQuantities((current) => ({ ...current, [key]: quantity }));
  const planned: PlannedItem[] = Object.entries(quantities).filter(([key, quantity]) => quantity > 0 && rows.some((row) => row.key === key)).map(([key, quantity]) => (key.startsWith('f:') ? { followupItemId: key.slice(2), quantity } : { procedureId: key.slice(2), quantity }));
  const fits = (minutes: number) => minutes <= left;
  return (
    <>
      <input type="hidden" name="items" value={JSON.stringify(planned)} />
      <Field label="Paciente">
        {lockedPatientId ? (
          <>
            <input type="hidden" name="patientId" value={lockedPatientId} />
            <div className="flex h-9 items-center rounded-lg border border-border bg-muted px-3 text-sm">{patients.find((patient) => patient.id === lockedPatientId)?.fullName}</div>
          </>
        ) : (
          <NativeSelect name="patientId" required value={patientId} onChange={(event) => { setPatientId(event.target.value); setQuantities({}); }}>
            {patients.map((patient) => <NativeSelectOption key={patient.id} value={patient.id}>{patient.fullName}</NativeSelectOption>)}
          </NativeSelect>
        )}
      </Field>
      {!selection && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Data"><DatePicker name="date" value={date} onChange={setDate} /></Field>
          <Field label="Início"><TimePicker name="start" value={start} onChange={setStart} /></Field>
          <Field label="Fim"><TimePicker name="end" value={end} onChange={setEnd} /></Field>
        </div>
      )}
      <div role="status" className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between text-sm">
          <strong>Tempo da sessão</strong>
          <span className={left < 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'}>{capacity > 0 ? `${used} de ${capacity} min usados` : 'Defina o horário para ver o tempo disponível'}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className={left < 0 ? 'h-full rounded-full bg-destructive transition-[width] duration-300 ease-out' : 'h-full rounded-full bg-primary transition-[width] duration-300 ease-out'} style={{ width: `${capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0}%` }} /></div>
      </div>
      {pending.length > 0 && <p role="alert" className="m-0 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Procedimentos bloqueados por anamnese pendente ({pending.join(", ")}). Conclua na ficha do paciente para liberar o agendamento.</p>}
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">Procedimentos dos acompanhamentos</legend>
        {mine.length === 0 && <p className="m-0 text-sm text-muted-foreground">Nenhum combo ou plano ativo para este paciente.</p>}
        {mine.map((followup) => (
          <div key={followup.id} className="grid gap-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{offerLabel(followup.offerType, followup.offerName)}</div>
            {followup.items.map((item) => {
              const key = `f:${item.id}`, minutes = minutesOfItem(item), quantity = quantities[key] ?? 0, max = item.sessionsTotal - item.sessionsPerformed;
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div className="flex-1 text-sm"><strong>{item.procedureName}</strong><div className="text-xs text-muted-foreground">{minutes} min por sessão · {item.sessionsPerformed}/{item.sessionsTotal} realizadas</div></div>
                  <Input aria-label={`Sessões de ${item.procedureName} (${followup.offerName})`} className="w-20" type="number" min={0} max={Math.min(max, quantity + Math.floor(Math.max(left, 0) / minutes))} disabled={followup.blocked} value={quantity} onChange={(event) => change(key, Math.max(0, Math.min(max, Number(event.target.value) || 0)))} />
                </div>
              );
            })}
          </div>
        ))}
      </fieldset>
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-medium">Procedimentos avulsos</legend>
        {avulsos.length === 0 && <p className="m-0 text-sm text-muted-foreground">Nenhum procedimento avulso cadastrado.</p>}
        {avulsos.map((procedure) => {
          const key = `p:${procedure.id}`, minutes = minutesOf(procedure.id), checked = (quantities[key] ?? 0) > 0;
          return (
            <Label key={procedure.id} className="cursor-pointer gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors duration-150 hover:bg-muted/40">
              <Checkbox checked={checked} disabled={!checked && (!fits(minutes) || blockedStandalone.has(procedure.id))} onCheckedChange={(value) => change(key, value === true ? 1 : 0)} />
              <span className="flex-1 text-sm"><strong>{procedure.name}</strong> <span className="text-xs text-muted-foreground">· {minutes} min</span></span>
            </Label>
          );
        })}
      </fieldset>
    </>
  );
}

// Escolha uma oferta do catálogo (combo ou plano) para iniciar o acompanhamento do paciente.
export function NewFollowupDialog({ open, patientId, patients, combos, plans, onClose }: { open: boolean; patientId?: string; patients: Patient[]; combos: Combo[]; plans: Plan[]; onClose: () => void }) {
  const create = useCreateFollowup();
  const navigate = useNavigate();
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Novo acompanhamento"
      description="Escolha um combo ou plano. Contratos e anamneses exigidos são gerados automaticamente. Procedimento avulso não precisa de acompanhamento: é só agendar."
      submitLabel="Iniciar acompanhamento"
      onSubmit={async (form) => {
        const { patientId: patient, offer } = parseForm(followupForm, form);
        const [offerType, offerId] = offer.split(':');
        await create.mutateAsync({ patientId: patient, offerType, offerId });
        if (!patientId) await navigate({ to: '/pacientes/$patientId', params: { patientId: patient } });
      }}
    >
      <OfferFields lockedPatientId={patientId} patients={patients} combos={combos} plans={plans} />
    </FormDialog>
  );
}

function OfferFields({ lockedPatientId, patients, combos, plans }: { lockedPatientId?: string; patients: Patient[]; combos: Combo[]; plans: Plan[] }) {
  const [offer, setOffer] = useState('');
  const [type, id] = offer.split(':');
  const price = type === 'combo' ? (combos.find((item) => item.id === id)?.promotionalPriceCents ?? combos.find((item) => item.id === id)?.priceCents) : type === 'plan' ? plans.find((item) => item.id === id)?.priceCents : undefined;
  return (
    <>
      <Field label="Paciente">
        {lockedPatientId ? (
          <>
            <input type="hidden" name="patientId" value={lockedPatientId} />
            <div className="flex h-9 items-center rounded-lg border border-border bg-muted px-3 text-sm">{patients.find((patient) => patient.id === lockedPatientId)?.fullName}</div>
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
  const received = followup?.payments.reduce((sum, payment) => sum + payment.amountCents, 0) ?? 0;
  const due = Math.max((followup?.priceCents ?? 0) - received, 0);
  return (
    <FormDialog
      open={!!followup}
      onOpenChange={(open) => !open && onClose()}
      title="Registrar pagamento"
      submitLabel="Registrar"
      description={followup && `${followup.offerName} · total ${currency(followup.priceCents)} · recebido ${currency(received)} · falta ${currency(due)}`}
      onSubmit={(form) => {
        const { amount, ...data } = parseForm(paymentForm, form);
        return create.mutateAsync({ ...data, followupId: followup!.id, amountCents: amount });
      }}
    >
      <Field label="Valor recebido R$" name="amount" type="number" step="0.01" min="0.01" defaultValue={followup ? (due / 100).toFixed(2) : ''} required />
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

// Atendimento avulso: sem acompanhamento nem contrato, só registrar o procedimento realizado.
export function StandaloneAttendanceDialog({ open, patientId, procedures, onClose }: { open: boolean; patientId: string; procedures: Procedure[]; onClose: () => void }) {
  const navigate = useNavigate();
  const avulsos = procedures.filter((procedure) => procedure.active !== false && procedure.standalone !== false);
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Atendimento avulso"
      description="Procedimento feito em uma única sessão, sem combo ou plano."
      submitLabel="Continuar"
      onSubmit={async (form) => {
        const procedureId = String(form.get('procedureId') ?? '');
        if (!procedureId) throw new Error('Escolha o procedimento.');
        await navigate({ to: '/pacientes/$patientId/avulso/$procedureId', params: { patientId, procedureId } });
      }}
    >
      <Field label="Procedimento">
        <NativeSelect name="procedureId" required>
          <NativeSelectOption value="">{avulsos.length ? 'Selecione…' : 'Nenhum procedimento avulso cadastrado'}</NativeSelectOption>
          {avulsos.map((procedure) => <NativeSelectOption key={procedure.id} value={procedure.id}>{procedure.name} · {currency(procedure.priceCents)}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
    </FormDialog>
  );
}
