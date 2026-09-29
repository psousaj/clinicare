import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { WalletCards } from 'lucide-react';
import { useState } from 'react';
import { PaymentDialog } from '@/components/dialogs';
import { QueryError } from '@/components/QueryState';
import { currency } from '@/lib/format';
import { patientsQuery, followupsQuery } from '@/lib/queries';
import type { Followup } from '@/lib/schemas';

export const Route = createFileRoute('/_app/financeiro')({ component: Finance });

function Finance() {
  const followups = useQuery(followupsQuery), patients = useQuery(patientsQuery);
  const [paymentFollowup, setPaymentFollowup] = useState<Followup | null>(null);
  const patientList = patients.data ?? [];
  return (
    <section className="panel">
      <div className="panel-header"><h2>Acompanhamentos</h2></div>
      <QueryError query={followups} />
      {followups.isSuccess && followups.data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum acompanhamento iniciado. Inicie um acompanhamento pela ficha do paciente ou pela visão geral.</p>}
      {(followups.data ?? []).map((followup) => (
        <div className="procedure-row" key={followup.id}>
          <WalletCards size={18} />
          <span className="procedure-info">
            <strong>{followup.offerName}</strong>
            <small>{patientList.find((patient) => patient.id === followup.patientId)?.fullName} · recebido {currency(followup.payments.reduce((sum, payment) => sum + payment.amountCents, 0))} de {currency(followup.priceCents)}</small>
          </span>
          <button className="text-button" onClick={() => setPaymentFollowup(followup)}>Registrar pagamento</button>
        </div>
      ))}
      <PaymentDialog followup={paymentFollowup} onClose={() => setPaymentFollowup(null)} />
    </section>
  );
}
