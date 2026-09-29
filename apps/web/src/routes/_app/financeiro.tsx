import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { WalletCards } from 'lucide-react';
import { useState } from 'react';
import { PaymentDialog } from '@/components/dialogs';
import { QueryError } from '@/components/QueryState';
import { currency } from '@/lib/format';
import { patientsQuery, attendancesQuery } from '@/lib/queries';
import type { Attendance } from '@/lib/schemas';

export const Route = createFileRoute('/_app/financeiro')({ component: Finance });

function Finance() {
  const attendances = useQuery(attendancesQuery), patients = useQuery(patientsQuery);
  const [paymentAttendance, setPaymentAttendance] = useState<Attendance | null>(null);
  const patientList = patients.data ?? [];
  return (
    <section className="panel">
      <div className="panel-header"><h2>Atendimentos</h2></div>
      <QueryError query={attendances} />
      {attendances.isSuccess && attendances.data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum atendimento iniciado. Inicie um atendimento pela ficha do paciente ou pela visão geral.</p>}
      {(attendances.data ?? []).map((attendance) => (
        <div className="procedure-row" key={attendance.id}>
          <WalletCards size={18} />
          <span className="procedure-info">
            <strong>{attendance.offerName}</strong>
            <small>{patientList.find((patient) => patient.id === attendance.patientId)?.fullName} · recebido {currency(attendance.payments.reduce((sum, payment) => sum + payment.amountCents, 0))} de {currency(attendance.priceCents)}</small>
          </span>
          <button className="text-button" onClick={() => setPaymentAttendance(attendance)}>Registrar pagamento</button>
        </div>
      ))}
      <PaymentDialog attendance={paymentAttendance} onClose={() => setPaymentAttendance(null)} />
    </section>
  );
}
