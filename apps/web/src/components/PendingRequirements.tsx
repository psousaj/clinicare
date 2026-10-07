import { Link } from '@tanstack/react-router';
import { BookOpenText, ClipboardList, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dateTime } from '@/lib/format';
import { useRequestAnamnesis } from '@/lib/queries';
import type { Followup } from '@/lib/schemas';

// Anamneses do paciente: pendentes (bloqueiam agendamento, com link/preenchimento)
// e respondidas (com leitura das respostas — antes sumiam da tela).
export function PendingRequirements({ followups, patientId }: { followups: Followup[]; patientId: string }) {
  const request = useRequestAnamnesis();
  const [link, setLink] = useState<string | null>(null);
  const pending = followups.flatMap((followup) => followup.anamneses.filter((form) => form.required && !form.answered).map((form) => ({ form, followup })));
  const answered = followups.flatMap((followup) => followup.anamneses.filter((form) => form.answered).map((form) => ({ form, followup })));
  if (pending.length === 0 && answered.length === 0) return null;

  async function copyLink(id: string) {
    const url = await request.mutateAsync(id);
    setLink(url);
    await navigator.clipboard.writeText(url).then(() => toast.success('Link copiado — envie ao paciente.'), () => toast.info('Copie o link exibido abaixo.'));
  }

  return (
    <>
      {pending.length > 0 && (
        <section className="panel" aria-label="Anamneses pendentes">
          <div className="panel-header"><div><div className="section-kicker">BLOQUEIA AGENDAMENTO</div><h2>Anamneses pendentes</h2></div></div>
          {pending.map(({ form, followup }) => (
            <div className="procedure-row" key={form.id}>
              <ClipboardList size={18} />
              <span className="procedure-info"><strong>{form.title}</strong><small>{followup.offerName}</small></span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => copyLink(form.id).catch(() => undefined)}><Copy /> Copiar link</Button>
                <Button size="sm" asChild><Link to="/pacientes/$patientId/anamneses/$formId" params={{ patientId, formId: form.id }}>Preencher agora</Link></Button>
              </div>
            </div>
          ))}
          {link && <Input readOnly value={link} aria-label="Link da anamnese" className="mt-3" onFocus={(event) => event.target.select()} />}
        </section>
      )}
      {answered.length > 0 && (
        <section className="panel" aria-label="Anamneses respondidas">
          <div className="panel-header"><div><div className="section-kicker">HISTÓRICO</div><h2>Anamneses respondidas</h2></div></div>
          {answered.map(({ form, followup }) => (
            <div className="procedure-row" key={form.id}>
              <ClipboardList size={18} />
              <span className="procedure-info">
                <strong>{form.title}</strong>
                <small>{followup.offerName}{form.submittedAt ? ` · respondida em ${dateTime(form.submittedAt)}` : ''}</small>
              </span>
              <Button size="sm" asChild>
                <Link to="/pacientes/$patientId/anamneses/$formId/respostas" params={{ patientId, formId: form.id }}>
                  <BookOpenText /> Ver respostas
                </Link>
              </Button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
