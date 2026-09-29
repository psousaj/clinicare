import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Camera, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PatientTimeline } from '@/components/PatientTimeline';
import { QueryError } from '@/components/QueryState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { currency, dateTime } from '@/lib/format';
import { anamnesesQuery, patientHistoryQuery, plansQuery, useRequestAnamnesis } from '@/lib/queries';

export const Route = createFileRoute('/_app/pacientes/$patientId/')({ component: PatientDetail });

function PatientDetail() {
  const { patientId } = Route.useParams();
  const history = useQuery(patientHistoryQuery(patientId)), plans = useQuery(plansQuery), anamneses = useQuery(anamnesesQuery);
  const requestAnamnesis = useRequestAnamnesis();
  const [link, setLink] = useState<string | null>(null);
  const patientPlans = (plans.data ?? []).filter((plan) => plan.patientId === patientId);
  const firstAnamnesis = anamneses.data?.[0];

  async function askForAnamnesis() {
    if (!firstAnamnesis) return toast.error('Crie um formulário de anamnese antes de solicitar.');
    setLink(await requestAnamnesis.mutateAsync({ patientId, anamnesisId: firstAnamnesis.id }));
    toast.success('Link criado — copie e envie ao paciente.');
  }

  const patient = history.data?.patient;
  const sessions = (history.data?.events ?? []).filter((entry) => entry.type === 'session' && entry.details?.id);
  return (
    <div className="grid gap-4">
      <section className="panel grid gap-3">
        <div className="panel-header">
          <div>
            <Link to="/pacientes" className="text-button mb-2"><ArrowLeft size={14} /> Pacientes</Link>
            <h2>{patient?.fullName ?? 'Paciente'}</h2>
            <p className="section-note m-0">{[patient?.phone, patient?.email].filter(Boolean).join(' · ') || (history.isSuccess ? 'Sem contato' : '')}</p>
          </div>
          <Button variant="outline" onClick={() => askForAnamnesis().catch(() => undefined)}>Solicitar anamnese</Button>
        </div>
        <QueryError query={history} />
        {link && (
          <div className="flex max-w-xl gap-2">
            <Input readOnly value={link} aria-label="Link da anamnese" onFocus={(event) => event.target.select()} />
            <Button variant="outline" size="icon" aria-label="Copiar link" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success('Link copiado.'))}><Copy /></Button>
          </div>
        )}
      </section>
      {history.data && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="grid gap-4">
            <section className="panel">
              <div className="panel-header"><h2>Contratações</h2></div>
              {patientPlans.length === 0 && <p className="text-sm text-muted-foreground">Contrate um procedimento para registrar sessões.</p>}
              {patientPlans.map((plan) => (
                <div key={plan.id} className="plan-card">
                  <strong>{plan.offerName} · {currency(plan.priceCents)}</strong>
                  {plan.items.map((item) => {
                    const done = item.sessionsPerformed >= item.sessionsTotal;
                    return (
                      <div className="procedure-row" key={item.id}>
                        <span className="procedure-info grid gap-1">
                          <span>{item.procedureName}</span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-accent"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (item.sessionsPerformed / item.sessionsTotal) * 100)}%` }} /></span>
                            {item.sessionsPerformed}/{item.sessionsTotal} sessões
                          </span>
                        </span>
                        {done
                          ? <span className="text-xs font-medium text-primary">Concluído</span>
                          : <Link className="text-button" to="/pacientes/$patientId/sessao/$itemId" params={{ patientId, itemId: item.id }}>Registrar sessão</Link>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </section>
            <section className="panel">
              <div className="panel-header"><div><div className="section-kicker">ACOMPANHAMENTO</div><h2>Sessões realizadas</h2></div></div>
              {sessions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessão registrada. Use “Registrar sessão” em uma contratação para começar o acompanhamento com fotos e observações.</p>}
              {sessions.map((entry) => (
                <Link key={entry.details!.id} className="procedure-row no-underline" style={{ color: 'inherit' }} to="/pacientes/$patientId/sessoes/$sessionId" params={{ patientId, sessionId: entry.details!.id! }}>
                  <span className="procedure-info grid gap-0.5">
                    <span>{entry.title.replace(/ realizado$/, '')}</span>
                    <span className="text-xs text-muted-foreground">{dateTime(entry.at)}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary"><Camera className="size-3.5" /> {entry.details?.photos?.length ?? 0} · Acompanhar</span>
                </Link>
              ))}
            </section>
            <section className="panel">
              <div className="panel-header"><h2>Pendências</h2></div>
              {history.data.pending.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pendência.</p>}
              {history.data.pending.map((entry, index) => <div className="procedure-row" key={index}>{entry.title}</div>)}
            </section>
          </div>
          <section className="panel">
            <div className="panel-header"><h2>Histórico</h2></div>
            <PatientTimeline events={history.data.events} patientId={patientId} />
          </section>
        </div>
      )}
    </div>
  );
}
