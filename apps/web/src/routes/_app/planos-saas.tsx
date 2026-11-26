import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { saasPlansQuery, saasSubscriptionQuery } from '@/lib/queries';

export const Route = createFileRoute('/_app/planos-saas')({
  component: () => <SaasPlansPage />,
});

const planNames = { free: 'Free', standard: 'Standard', pro: 'Pró' } as const;
const capabilityNames: Record<string, string> = {
  'dashboard.upcoming_sessions': 'Próximas sessões',
  'dashboard.recent_patients': 'Pacientes recentes',
  'patients.crud': 'Cadastro, busca e histórico de pacientes',
  'attendances.single_sessions': 'Atendimentos avulsos',
  'appointments.single_sessions': 'Agenda de atendimentos avulsos',
  'catalog.single_procedures': 'Procedimentos avulsos',
  'anamnesis.in_clinic': 'Anamnese preenchida na clínica',
  'finance.single_session_payments': 'Pagamentos de atendimentos avulsos',
  'contracts.docx_import': 'Importação de modelos DOCX',
  'documents.historical_read': 'Consulta de documentos históricos autorizados',
  'settings.clinic_account': 'Configurações da clínica e da conta',
  'dashboard.document_tasks': 'Pendências de documentos',
  'patient.session_photos': 'Fotos dos atendimentos',
  'patient.custom_fields': 'Campos personalizados',
  followups: 'Acompanhamentos de tratamentos',
  'appointments.followup_sessions': 'Agenda de sessões de acompanhamentos',
  'catalog.combos': 'Combos',
  'catalog.clinical_plans': 'Planos clínicos',
  'anamnesis.public_links': 'Anamnese por link',
  'contracts.generation': 'Geração de contratos com dados do paciente',
  'contracts.patient_signatures': 'Assinaturas eletrônicas pelo app',
  'finance.followups': 'Financeiro consolidado de acompanhamentos',
  events: 'Procedimentos do evento e inscrições',
  'patient.relationship_indicators': 'Indicadores de relacionamento por paciente',
  'signatures.govbr': 'Assinaturas externas GOV.BR',
};

export function SaasPlansPage() {
  const plans = useQuery(saasPlansQuery);
  const subscription = useQuery(saasSubscriptionQuery);
  if (plans.isPending || subscription.isPending) return <p role="status">Carregando planos…</p>;
  if (plans.isError || subscription.isError) return <p role="alert">Não foi possível carregar os planos.</p>;

  return (
    <main className="mx-auto grid max-w-5xl gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Planos da Clínicare</h1>
        <p>Compare os recursos disponíveis. Escolher um plano não altera o acesso da sua clínica.</p>
      </header>
      <p>Plano efetivo da clínica: <strong>{planNames[subscription.data.effectivePlan]}</strong></p>
      <p>Situação comercial: <strong>
        {!subscription.data.subscription ? 'Sem assinatura paga' :
          subscription.data.subscription.status === 'active' ? 'Ativa' :
            subscription.data.subscription.status === 'paused' ? 'Pausada · acesso Free' : 'Cancelada · acesso Free'}
      </strong></p>
      <section className="grid gap-4 md:grid-cols-3" aria-label="Comparação de planos">
        {plans.data.map((plan) => (
          <article key={plan.id} className="rounded-xl border p-5">
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <p>{plan.priceCents === null ? 'Preço a definir' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.priceCents / 100)}{plan.billingInterval ? ` / ${plan.billingInterval === 'month' ? 'mês' : 'ano'}` : ''}</p>
            <ul>{plan.capabilities.map((capability) => <li key={capability}>{capabilityNames[capability] ?? capability}</li>)}</ul>
            {plan.id === subscription.data.effectivePlan && <p aria-current="true">Plano efetivo</p>}
          </article>
        ))}
      </section>
    </main>
  );
}
