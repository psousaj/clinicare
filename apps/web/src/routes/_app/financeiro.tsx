import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { WalletCards } from 'lucide-react';
import { useState } from 'react';
import { PaymentDialog } from '@/components/dialogs';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { currency } from '@/lib/format';
import { patientsQuery, followupsQuery } from '@/lib/queries';
import type { Followup } from '@/lib/schemas';

export const Route = createFileRoute('/_app/financeiro')({ component: Finance });

function Finance() {
  const followups = useQuery(followupsQuery), patients = useQuery(patientsQuery);
  const [paymentFollowup, setPaymentFollowup] = useState<Followup | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const patientList = patients.data ?? [];
  const entries = followups.data ?? [];
  const received = (entry: Followup) => entry.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const balance = (entry: Followup) => Math.max(entry.priceCents - received(entry), 0);
  const totalReceived = entries.reduce((sum, entry) => sum + received(entry), 0);
  const totalBalance = entries.reduce((sum, entry) => sum + balance(entry), 0);
  const openEntries = entries.filter((entry) => balance(entry) > 0).length;
  const filteredEntries = entries.filter((entry) => filter === 'all' || (filter === 'pending' ? balance(entry) > 0 : balance(entry) === 0));
  return (
    <section className="panel">
      <div className="panel-header"><div><div className="section-kicker">PAGAMENTOS E SALDOS</div><h2>Financeiro</h2></div></div>
      <QueryError query={followups} />
      {followups.isSuccess && <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <FinanceSummary label="Recebido" amount={currency(totalReceived)} detail="Soma dos pagamentos registrados" tone="text-primary" />
        <FinanceSummary label="A receber" amount={currency(totalBalance)} detail="Saldo pendente nos acompanhamentos" tone={totalBalance ? 'text-amber-700' : 'text-primary'} />
        <FinanceSummary label="Em aberto" amount={String(openEntries)} detail="Acompanhamentos com saldo" tone="text-foreground" />
      </div>}
      {followups.isSuccess && entries.length === 0 && <p className="text-sm text-muted-foreground">Nenhum acompanhamento iniciado. Inicie um acompanhamento pela ficha do paciente para acompanhar pagamentos e saldos.</p>}
      {followups.isPending && <p className="text-sm text-muted-foreground">Carregando acompanhamentos…</p>}
      {followups.isSuccess && <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar financeiro">
        {([['all', `Todos (${entries.length})`], ['pending', `Pendentes (${openEntries})`], ['paid', `Pagos (${entries.length - openEntries})`]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${filter === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-white text-foreground hover:bg-muted'}`}>{label}</button>)}
      </div>}
      <div className="grid gap-3">
        {filteredEntries.map((followup) => {
          const paid = received(followup), due = balance(followup), settled = due === 0;
          return <article className="rounded-xl border border-border p-4" key={followup.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><WalletCards size={18} /></span>
                <div className="min-w-0"><h3 className="m-0 truncate text-sm font-semibold">{followup.offerName}</h3><p className="m-0 mt-1 text-xs text-muted-foreground">{patientList.find((patient) => patient.id === followup.patientId)?.fullName ?? 'Paciente'}</p></div>
              </div>
              <StatusBadge tone={settled ? 'success' : paid > 0 ? 'warning' : 'neutral'}>{settled ? 'Quitado' : paid > 0 ? 'Parcial' : 'Pendente'}</StatusBadge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MoneyLine label="Valor total" amount={currency(followup.priceCents)} />
              <MoneyLine label="Recebido" amount={currency(paid)} />
              <MoneyLine label="Falta receber" amount={currency(due)} emphasis={due > 0} />
            </div>
            {due > 0 && <div className="mt-4 flex justify-end"><button className="text-button" onClick={() => setPaymentFollowup(followup)}>Registrar pagamento</button></div>}
          </article>;
        })}
        {followups.isSuccess && entries.length > 0 && filteredEntries.length === 0 && <p className="m-0 text-sm text-muted-foreground">Nenhum registro nesta categoria.</p>}
      </div>
      <PaymentDialog followup={paymentFollowup} onClose={() => setPaymentFollowup(null)} />
    </section>
  );
}

function FinanceSummary({ label, amount, detail, tone }: { label: string; amount: string; detail: string; tone: string }) {
  return <div className="rounded-xl border border-border bg-muted/20 p-4"><div className="text-xs font-medium text-muted-foreground">{label}</div><div className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{amount}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div>;
}

function MoneyLine({ label, amount, emphasis = false }: { label: string; amount: string; emphasis?: boolean }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-0.5 text-sm font-semibold tabular-nums ${emphasis ? 'text-amber-700' : ''}`}>{amount}</div></div>;
}
