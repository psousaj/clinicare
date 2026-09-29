import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { WalletCards } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { PaymentDialog } from '@/components/dialogs';
import { QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { ApiError } from '@/lib/api';
import { parseForm, planForm } from '@/lib/forms';
import { currency } from '@/lib/format';
import { packagesQuery, patientsQuery, plansQuery, proceduresQuery, useCreatePlan } from '@/lib/queries';
import type { Plan } from '@/lib/schemas';

export const Route = createFileRoute('/_app/financeiro')({ component: Finance });

function Finance() {
  const plans = useQuery(plansQuery), patients = useQuery(patientsQuery), procedures = useQuery(proceduresQuery), packages = useQuery(packagesQuery);
  const createPlan = useCreatePlan();
  const [paymentPlan, setPaymentPlan] = useState<Plan | null>(null);
  const patientList = patients.data ?? [];

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    try {
      const { patientId, offer, price } = parseForm(planForm, new FormData(formElement));
      const [offerType, offerId] = offer.split(':');
      await createPlan.mutateAsync({ patientId, offerType, offerId, priceCents: price });
      formElement.reset();
    } catch (error) {
      if (!(error instanceof ApiError)) toast.error((error as Error).message);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header"><h2>Contratações</h2></div>
      <QueryError query={plans} />
      {(plans.data ?? []).map((plan) => (
        <div className="procedure-row" key={plan.id}>
          <WalletCards size={18} />
          <span className="procedure-info">
            <strong>{plan.offerName}</strong>
            <small>{patientList.find((patient) => patient.id === plan.patientId)?.fullName} · recebido {currency(plan.payments.reduce((sum, payment) => sum + payment.amountCents, 0))} de {currency(plan.priceCents)}</small>
          </span>
          <button className="text-button" onClick={() => setPaymentPlan(plan)}>Registrar pagamento</button>
        </div>
      ))}
      {patientList.length > 0 && (
        <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={submitPlan}>
          <h3 className="text-sm font-semibold sm:col-span-2">Registrar nova contratação</h3>
          <NativeSelect name="patientId" aria-label="Paciente" required>
            {patientList.map((patient) => <NativeSelectOption key={patient.id} value={patient.id}>{patient.fullName}</NativeSelectOption>)}
          </NativeSelect>
          <NativeSelect name="offer" aria-label="Oferta" required>
            <optgroup label="Procedimentos">
              {(procedures.data ?? []).map((procedure) => <NativeSelectOption key={procedure.id} value={`procedure:${procedure.id}`}>{procedure.name}</NativeSelectOption>)}
            </optgroup>
            <optgroup label="Pacotes">
              {(packages.data ?? []).map((pack) => <NativeSelectOption key={pack.id} value={`package:${pack.id}`}>{pack.name}</NativeSelectOption>)}
            </optgroup>
          </NativeSelect>
          <Input name="price" type="number" min="0" step="0.01" placeholder="Preço contratado R$" required />
          <Button type="submit" disabled={createPlan.isPending}>Registrar contratação</Button>
        </form>
      )}
      <PaymentDialog plan={paymentPlan} onClose={() => setPaymentPlan(null)} />
    </section>
  );
}
