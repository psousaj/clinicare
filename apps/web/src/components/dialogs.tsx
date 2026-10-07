import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StatusBadge } from '@/components/StatusBadge';
import { Field, FormDialog } from '@/components/FormDialog';
import { DatePicker, TimePicker } from '@/components/pickers';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlanOfferPicker } from '@/components/PlanOfferPicker';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { appointmentForm, followupForm, parseForm, paymentForm } from '@/lib/forms';
import { useConfirmAppointment, useCreateAppointment, useCreateFollowup, useCreatePayment, useDeleteAppointment, useUpdateAppointment } from '@/lib/queries';
import type { Appointment, EventOffer, Followup, Combo, Patient, Plan, Procedure } from '@/lib/schemas';
import { currency, offerLabel } from '@/lib/format';

type Selection = { start: string; end: string };
type PlannedItem = { followupItemId?: string; procedureId?: string; quantity: number };

const minutesBetween = (start: string, end: string) => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);

// Sem `selection` (ex.: botão da visão geral) o horário é escolhido no próprio formulário.
const localDate = (value: string) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const localTime = (value: string) => { const date = new Date(value); return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; };

export function AppointmentDialog({ open, selection, appointment, patientId, patients, followups, procedures, onClose }: { open: boolean; selection?: Selection | null; appointment?: Appointment | null; patientId?: string; patients: Patient[]; followups: Followup[]; procedures: Procedure[]; onClose: () => void }) {
  const create = useCreateAppointment(), update = useUpdateAppointment(), remove = useDeleteAppointment(), confirm = useConfirmAppointment();
  const createPayment = useCreatePayment();
  const [date, setDate] = useState<string>(), [start, setStart] = useState<string>(), [end, setEnd] = useState<string>();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [paymentStep, setPaymentStep] = useState(false), [paymentAmount, setPaymentAmount] = useState(''), [paymentMethod, setPaymentMethod] = useState<'pix' | 'cash' | 'credit_card'>('pix');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setConfirmDelete(false);
    setPaymentStep(false); setPaymentAmount('');
    if (!appointment) { setDate(undefined); setStart(undefined); setEnd(undefined); setSelectedItemIds([]); return; }
    setDate(localDate(appointment.startsAt)); setStart(localTime(appointment.startsAt)); setEnd(localTime(appointment.endsAt));
    setSelectedItemIds(appointment.items.filter((item) => item.confirmationStatus !== 'deselected').map((item) => item.id));
  }, [appointment?.id]);
  const description = appointment
    ? `${new Date(appointment.startsAt).toLocaleString('pt-BR')} – ${new Date(appointment.endsAt).toLocaleTimeString('pt-BR')}`
    : selection ? `${new Date(selection.start).toLocaleString('pt-BR')} – ${new Date(selection.end).toLocaleTimeString('pt-BR')}` : 'Escolha o paciente, o horário e o que será realizado na sessão.';
  const selectedFollowupIds = appointment ? [...new Set(appointment.items.filter((item) => selectedItemIds.includes(item.id) && item.followupId).map((item) => item.followupId!))] : [];
  const unpaidFollowups = selectedFollowupIds.map((id) => followups.find((followup) => followup.id === id)).filter((followup): followup is Followup => !!followup).map((followup) => ({ followup, due: Math.max(0, followup.priceCents - followup.payments.reduce((sum, payment) => sum + payment.amountCents, 0)) })).filter(({ due }) => due > 0);
  const confirmSelected = async () => {
    if (!appointment) return;
    const parsedAmount = Number(paymentAmount.replace(',', '.'));
    if (paymentStep && paymentAmount.trim() && (!Number.isFinite(parsedAmount) || parsedAmount < 0)) throw new Error('Informe um valor válido ou deixe zero para registrar depois.');
    const amountCents = Math.round(parsedAmount * 100);
    if (paymentStep && amountCents > 0) {
      const target = unpaidFollowups[0];
      if (!target || amountCents > target.due) throw new Error('O valor não pode exceder o saldo do acompanhamento.');
      await createPayment.mutateAsync({ followupId: target.followup.id, amountCents, method: paymentMethod });
    }
    await confirm.mutateAsync({ id: appointment.id, selectedItemIds });
    onClose();
  };
  const actions = appointment && appointment.status !== 'confirmed' ? (
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
          <div className="rounded-lg border border-border p-3"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Procedimentos agendados</div><ul className="m-0 grid gap-1 text-sm">{appointment.items.map((item) => <li key={item.id} className="flex items-center gap-2"><Checkbox checked={selectedItemIds.includes(item.id)} onCheckedChange={(checked) => setSelectedItemIds((current) => checked === true ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))} disabled={item.confirmationStatus === 'confirmed'} aria-label={`Selecionar ${item.procedureName}`} /> <span>{item.procedureName}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</span> <StatusBadge tone={item.followupItemId ? 'neutral' : 'warning'}>{item.followupItemId ? 'Abate o plano' : 'Avulso'}</StatusBadge></li>)}</ul>
            {unpaidFollowups.length > 0 && <div className="mt-3 grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3"><strong className="text-sm">Pagamento do acompanhamento pendente</strong><p className="m-0 text-xs text-muted-foreground">Saldo de {unpaidFollowups[0]!.followup.offerName}: {currency(unpaidFollowups[0]!.due)}. Informe o valor recebido agora ou deixe zero para registrar depois no Financeiro.</p><div className="grid gap-2 sm:grid-cols-2"><Field label="Valor recebido (R$)"><Input aria-label="Valor recebido do plano" inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="0,00" /></Field><Field label="Forma de pagamento"><NativeSelect aria-label="Forma de pagamento da confirmação" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}><NativeSelectOption value="pix">PIX</NativeSelectOption><NativeSelectOption value="cash">Dinheiro</NativeSelectOption><NativeSelectOption value="credit_card">Cartão de crédito</NativeSelectOption></NativeSelect></Field></div></div>}
            <div className="mt-3 flex flex-wrap gap-2">{unpaidFollowups.length > 0 && !paymentStep ? <Button type="button" disabled={appointment.status !== 'planned' && appointment.status !== 'rescheduled'} onClick={() => setPaymentStep(true)}>Continuar para pagamento</Button> : <Button type="button" disabled={confirm.isPending || createPayment.isPending || appointment.status !== 'planned' && appointment.status !== 'rescheduled'} onClick={() => void confirmSelected().catch((error: Error) => toast.error(error.message))}>{paymentStep ? 'Registrar e confirmar atendimento' : 'Confirmar atendimento'}</Button>}{paymentStep && <Button type="button" variant="outline" onClick={() => { setPaymentAmount(''); setPaymentStep(false); }}>Voltar</Button>}</div></div>
        </>
      ) : <AppointmentFields selection={selection} lockedPatientId={patientId} patients={patients} followups={followups} procedures={procedures} />}
    </FormDialog>
  );
}

// Monta a sessão: procedimentos avulsos e sessões dos acompanhamentos do paciente, limitados pelos minutos do horário.
function AppointmentFields({ selection, lockedPatientId, patients, followups, procedures }: { selection?: Selection | null; lockedPatientId?: string; patients: Patient[]; followups: Followup[]; procedures: Procedure[] }) {
  const [patientId, setPatientId] = useState(lockedPatientId ?? patients[0]?.id ?? '');
  const [patientPickerOpen, setPatientPickerOpen] = useState(false), [patientQuery, setPatientQuery] = useState('');
  const [date, setDate] = useState<string>(), [start, setStart] = useState<string>(), [end, setEnd] = useState<string>();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const capacity = selection ? minutesBetween(selection.start, selection.end) : date && start && end ? minutesBetween(`${date}T${start}`, `${date}T${end}`) : 0;
  const minutesOf = (procedureId?: string | null) => procedures.find((procedure) => procedure.id === procedureId)?.durationMinutes ?? 60;
  const minutesOfItem = (item: { procedureId?: string | null; durationMinutes?: number | null }) => item.durationMinutes ?? minutesOf(item.procedureId);
  const patientFollowups = followups.filter((followup) => followup.patientId === patientId);
  const blockedStandalone = new Set(patientFollowups.filter((followup) => followup.offerType === 'procedure' && followup.blocked).flatMap((followup) => followup.items.map((item) => item.procedureId)));
  const mine = patientFollowups.filter((followup) => followup.offerType !== 'procedure').map((followup) => ({ ...followup, items: followup.items.filter((item) => item.sessionsPerformed < item.sessionsTotal) })).filter((followup) => followup.items.length > 0);
  const contractedProcedureIds = new Set(mine.flatMap((followup) => followup.items.map((item) => item.procedureId).filter(Boolean)));
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
          <>
          <input type="hidden" name="patientId" value={patientId} required />
          <Popover open={patientPickerOpen} onOpenChange={(open) => { setPatientPickerOpen(open); if (!open) setPatientQuery(''); }}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" role="combobox" aria-expanded={patientPickerOpen} aria-label="Paciente" className="w-full justify-between font-normal">
                {patients.find((patient) => patient.id === patientId)?.fullName ?? 'Selecione o paciente'}
                <ChevronsUpDown className="size-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-2">
              <label className="mb-2 flex items-center gap-2 rounded-md border border-border px-2">
                <Search className="size-4 text-muted-foreground" />
                <input autoFocus className="h-9 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none" placeholder="Buscar paciente por nome" aria-label="Buscar paciente" value={patientQuery} onChange={(event) => setPatientQuery(event.target.value)} />
              </label>
              <div role="listbox" aria-label="Pacientes" className="grid max-h-64 gap-1 overflow-y-auto">
                {patients.filter((patient) => patient.fullName.toLocaleLowerCase('pt-BR').includes(patientQuery.trim().toLocaleLowerCase('pt-BR'))).map((patient) => (
                  <button key={patient.id} type="button" role="option" aria-selected={patientId === patient.id} className="flex cursor-pointer items-center justify-between rounded-md border-0 bg-transparent px-2 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setPatientId(patient.id); setQuantities({}); setPatientPickerOpen(false); setPatientQuery(''); }}>
                    {patient.fullName}{patientId === patient.id && <Check aria-hidden="true" className="size-4 text-primary" />}
                  </button>
                ))}
                {patients.filter((patient) => patient.fullName.toLocaleLowerCase('pt-BR').includes(patientQuery.trim().toLocaleLowerCase('pt-BR'))).length === 0 && <p className="m-0 p-3 text-center text-sm text-muted-foreground">Nenhum paciente encontrado.</p>}
              </div>
            </PopoverContent>
          </Popover>
          </>
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
      <fieldset className="m-0 grid gap-2 border-0 border-l-4 border-primary p-3 pl-4">
        <legend className="px-1 text-sm font-semibold text-primary">Do acompanhamento <StatusBadge tone="success">ABATE SESSÕES</StatusBadge></legend>
        <p className="m-0 text-xs text-muted-foreground">Selecione aqui para usar uma sessão já contratada. A baixa acontece quando confirmar o atendimento.</p>
        {mine.length === 0 && <p className="m-0 text-sm text-muted-foreground">Nenhum combo ou plano ativo para este paciente.</p>}
        {mine.map((followup) => (
          <div key={followup.id} className="grid gap-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{offerLabel(followup.offerType, followup.offerName)}</div>
            {followup.items.map((item) => {
              const key = `f:${item.id}`, minutes = minutesOfItem(item), quantity = quantities[key] ?? 0, max = item.sessionsTotal - item.sessionsPerformed;
              return (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div className="flex-1 text-sm"><strong>{item.procedureName}</strong><div className="text-xs text-muted-foreground">{minutes} min por sessão · {item.sessionsPerformed}/{item.sessionsTotal} realizadas · abate do plano</div></div>
                  <Input aria-label={`Sessões de ${item.procedureName} (${followup.offerName}) — abate do plano`} className="w-20" type="number" min={0} max={Math.min(max, quantity + Math.floor(Math.max(left, 0) / minutes))} disabled={followup.blocked} value={quantity} onChange={(event) => change(key, Math.max(0, Math.min(max, Number(event.target.value) || 0)))} />
                </div>
              );
            })}
          </div>
        ))}
      </fieldset>
      <fieldset className="m-0 grid gap-2 border-0 border-l-4 border-amber-500 p-3 pl-4">
        <legend className="px-1 text-sm font-semibold text-amber-900">Avulso <StatusBadge tone="warning">COBRADO À PARTE</StatusBadge></legend>
        <p className="m-0 text-xs text-muted-foreground">Selecione aqui para cobrar como avulso. Isso <strong>não usa</strong> sessões do plano, mesmo que o procedimento tenha o mesmo nome.</p>
        {avulsos.length === 0 && <p className="m-0 text-sm text-muted-foreground">Nenhum procedimento avulso cadastrado.</p>}
        {avulsos.map((procedure) => {
          const key = `p:${procedure.id}`, minutes = minutesOf(procedure.id), checked = (quantities[key] ?? 0) > 0;
          const contracted = contractedProcedureIds.has(procedure.id);
          return (
            <Label key={procedure.id} className="cursor-pointer gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors duration-150 hover:bg-muted/40">
              <Checkbox checked={checked} disabled={!checked && (!fits(minutes) || blockedStandalone.has(procedure.id))} onCheckedChange={(value) => change(key, value === true ? 1 : 0)} />
              <span className="flex-1 text-sm"><strong>{procedure.name}</strong> <span className="text-xs text-muted-foreground">· {minutes} min · avulso</span>
                {contracted && <span className="mt-0.5 block text-xs font-medium text-amber-800">Também contratado no plano: marcar aqui faz avulso (não abate). Para abater, marque na seção do acompanhamento acima.</span>}
              </span>
            </Label>
          );
        })}
      </fieldset>
      {planned.length > 0 && (
        <div role="status" className="rounded-lg border border-border p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo da sessão</div>
          <ul className="m-0 grid gap-1 pl-5 text-sm">
            {planned.map((entry) => {
              if (entry.followupItemId) {
                const found = patientFollowups.flatMap((followup) => followup.items.map((item) => ({ item, offerName: followup.offerName }))).find((candidate) => candidate.item.id === entry.followupItemId);
                return <li key={`f:${entry.followupItemId}`}>{found?.item.procedureName ?? 'Procedimento'} ×{entry.quantity} — <strong>abate do plano</strong>{found ? ` ${found.offerName}` : ''}</li>;
              }
              return <li key={`p:${entry.procedureId}`}>{procedures.find((procedure) => procedure.id === entry.procedureId)?.name ?? 'Procedimento'} ×{entry.quantity} — <strong>avulso (não abate)</strong></li>;
            })}
          </ul>
        </div>
      )}
    </>
  );
}

// Escolha uma oferta do catálogo (combo ou plano) para iniciar o acompanhamento do paciente.
export function NewFollowupDialog({ open, patientId, patients, combos, plans, events = [], procedures = [], onClose }: { open: boolean; patientId?: string; patients: Patient[]; combos: Combo[]; plans: Plan[]; events?: EventOffer[]; procedures?: Procedure[]; onClose: () => void }) {
  const create = useCreateFollowup();
  const navigate = useNavigate();
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Novo acompanhamento"
      description="Escolha um combo, plano ou evento. Contratos e anamneses exigidos são gerados automaticamente. Procedimento avulso não precisa de acompanhamento: é só agendar."
      submitLabel="Iniciar acompanhamento"
      onSubmit={async (form) => {
        const { patientId: patient, offer } = parseForm(followupForm, form);
        const [offerType, offerId] = offer.split(':');
        const choice = offerType === 'event' ? form.getAll('choice').map(String).map((key) => { const [kind, id] = key.split(':'); return kind === 'combo' ? { kind, comboId: id } : { kind, procedureId: id }; }) : undefined;
        if (offerType === 'event' && !choice?.length) throw new Error('Escolha ao menos um item do cardápio do evento.');
        await create.mutateAsync({ patientId: patient, offerType, offerId, ...(choice ? { choice } : {}) });
        if (!patientId) await navigate({ to: '/pacientes/$patientId', params: { patientId: patient } });
      }}
    >
      <OfferFields lockedPatientId={patientId} patients={patients} combos={combos} plans={plans} events={events} procedures={procedures} />
    </FormDialog>
  );
}

function OfferFields({ lockedPatientId, patients, combos, plans, events, procedures }: { lockedPatientId?: string; patients: Patient[]; combos: Combo[]; plans: Plan[]; events: EventOffer[]; procedures: Procedure[] }) {
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
          {events.filter((event) => event.active !== false).map((event) => <NativeSelectOption key={event.id} value={`event:${event.id}`}>{offerLabel('event', `${event.name} (${event.eventDate.split('-').reverse().join('/')})`)}</NativeSelectOption>)}
        </NativeSelect>
      </Field>
      {price !== undefined && <p className="m-0 text-sm text-muted-foreground">Valor: <strong className="text-foreground">{currency(price)}</strong></p>}
      {type === 'event' && <EventChoice key={id} event={events.find((item) => item.id === id)} procedures={procedures} combos={combos} />}
    </>
  );
}

// Escolha do paciente no cardápio do evento. Não é preço contratado: o valor só nasce da baixa do que for realizado.
function EventChoice({ event, procedures, combos }: { event?: EventOffer; procedures: Procedure[]; combos: Combo[] }) {
  const menuProcedures = (event?.items ?? []).filter((item) => item.kind === 'procedure').map((item) => item.procedureId);
  const menuCombos = (event?.items ?? []).filter((item) => item.kind === 'combo').map((item) => item.comboId);
  const [procedureIds, setProcedureIds] = useState<string[]>([]);
  const [comboIds, setComboIds] = useState<string[]>([]);
  if (!event) return null;
  const toggleList = (list: string[], setter: (next: string[]) => void, id: string, on: boolean) => setter(on ? [...list.filter((entry) => entry !== id), id] : list.filter((entry) => entry !== id));
  return (
    <fieldset className="grid gap-1">
      <PlanOfferPicker
        procedures={procedures.filter((procedure) => menuProcedures.includes(procedure.id))}
        combos={combos.filter((combo) => menuCombos.includes(combo.id))}
        procedureIds={procedureIds}
        comboIds={comboIds}
        sessions={{}}
        sessionsEditable={false}
        onToggleProcedure={(id, on) => toggleList(procedureIds, setProcedureIds, id, on)}
        onToggleCombo={(id, on) => toggleList(comboIds, setComboIds, id, on)}
        onSessionsChange={() => undefined}
      />
      {procedureIds.map((id) => <input key={`procedure:${id}`} type="hidden" name="choice" value={`procedure:${id}`} />)}
      {comboIds.map((id) => <input key={`combo:${id}`} type="hidden" name="choice" value={`combo:${id}`} />)}
      <small className="text-xs text-muted-foreground">A escolha vai para o contrato. O valor só é cobrado pelo que o profissional der baixa.</small>
    </fieldset>
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
      description={followup && `${followup.offerName} · ${followup.offerType === 'event' ? 'realizado' : 'total'} ${currency(followup.priceCents)} · recebido ${currency(received)} · falta ${currency(due)}`}
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
