import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { SessionDialog } from '@/components/dialogs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { currency, dateTime } from '@/lib/format';
import { anamnesesQuery, patientHistoryQuery, plansQuery, useRequestAnamnesis } from '@/lib/queries';
import type { PlanItem } from '@/lib/schemas';

export const Route = createFileRoute('/_app/pacientes/$patientId')({ component: PatientDetail });

function PatientDetail() {
  const { patientId } = Route.useParams();
  const navigate = useNavigate();
  const history = useQuery(patientHistoryQuery(patientId)), plans = useQuery(plansQuery), anamneses = useQuery(anamnesesQuery);
  const requestAnamnesis = useRequestAnamnesis();
  const [link, setLink] = useState<string | null>(null), [sessionItem, setSessionItem] = useState<PlanItem | null>(null);
  const patientPlans = (plans.data ?? []).filter((plan) => plan.patientId === patientId);
  const firstAnamnesis = anamneses.data?.[0];

  async function askForAnamnesis() {
    if (!firstAnamnesis) return toast.error('Crie uma anamnese antes de solicitar.');
    setLink(await requestAnamnesis.mutateAsync({ patientId, anamnesisId: firstAnamnesis.id }));
    toast.success('Link criado — copie e envie ao paciente.');
  }

  const patient = history.data?.patient;
  return (
    <Dialog open onOpenChange={(open) => !open && navigate({ to: '/pacientes', search: (previous) => previous })}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-[Manrope] text-xl font-bold tracking-tight">{patient?.fullName ?? 'Paciente'}</DialogTitle>
          <DialogDescription>{history.isError ? history.error.message : [patient?.phone, patient?.email].filter(Boolean).join(' · ') || 'Sem contato'}</DialogDescription>
        </DialogHeader>
        {history.data && (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => askForAnamnesis().catch(() => undefined)}>Solicitar anamnese</Button>
            </div>
            {link && (
              <div className="flex gap-2">
                <Input readOnly value={link} aria-label="Link da anamnese" onFocus={(event) => event.target.select()} />
                <Button variant="outline" size="icon" aria-label="Copiar link" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success('Link copiado.'))}><Copy /></Button>
              </div>
            )}
            <section>
              <h3 className="mt-0 mb-1 text-sm font-semibold">Pendências</h3>
              {history.data.pending.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pendência.</p>}
              {history.data.pending.map((entry, index) => <div className="procedure-row" key={index}>{entry.title}</div>)}
            </section>
            <section>
              <h3 className="mt-0 mb-1 text-sm font-semibold">Contratações</h3>
              {patientPlans.length === 0 && <p className="text-sm text-muted-foreground">Contrate um procedimento para registrar sessões.</p>}
              {patientPlans.map((plan) => (
                <div key={plan.id} className="plan-card">
                  <strong>{plan.offerName} · {currency(plan.priceCents)}</strong>
                  {plan.items.map((item) => (
                    <div className="procedure-row" key={item.id}>
                      <span className="procedure-info">{item.procedureName} — {item.sessionsTotal} sessões</span>
                      <button className="text-button" onClick={() => setSessionItem(item)}>Registrar sessão</button>
                    </div>
                  ))}
                </div>
              ))}
            </section>
            <section>
              <h3 className="mt-0 mb-1 text-sm font-semibold">Histórico</h3>
              {history.data.events.map((entry, index) => (
                <div className="history-event" key={index}>
                  <time>{dateTime(entry.at)}</time>
                  <strong>{entry.title}</strong>
                  <small>{entry.type}</small>
                </div>
              ))}
            </section>
          </div>
        )}
        <SessionDialog item={sessionItem} onClose={() => setSessionItem(null)} />
      </DialogContent>
    </Dialog>
  );
}
