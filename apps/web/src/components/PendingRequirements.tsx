import { Link } from '@tanstack/react-router';
import { ClipboardList, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRequestAnamnesis } from '@/lib/queries';
import type { Attendance } from '@/lib/schemas';

// Anamneses que impedem o agendamento: o paciente responde pelo link ou o profissional preenche na clínica.
export function PendingRequirements({ attendances, patientId }: { attendances: Attendance[]; patientId: string }) {
  const request = useRequestAnamnesis();
  const [link, setLink] = useState<string | null>(null);
  const pending = attendances.flatMap((attendance) => attendance.anamneses.filter((form) => form.required && !form.answered).map((form) => ({ form, attendance })));
  if (pending.length === 0) return null;

  async function copyLink(id: string) {
    const url = await request.mutateAsync(id);
    setLink(url);
    await navigator.clipboard.writeText(url).then(() => toast.success('Link copiado — envie ao paciente.'), () => toast.info('Copie o link exibido abaixo.'));
  }

  return (
    <section className="panel" aria-label="Anamneses pendentes">
      <div className="panel-header"><div><div className="section-kicker">BLOQUEIA AGENDAMENTO</div><h2>Anamneses pendentes</h2></div></div>
      {pending.map(({ form, attendance }) => (
        <div className="procedure-row" key={form.id}>
          <ClipboardList size={18} />
          <span className="procedure-info"><strong>{form.title}</strong><small>{attendance.offerName}</small></span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => copyLink(form.id).catch(() => undefined)}><Copy /> Copiar link</Button>
            <Button size="sm" asChild><Link to="/pacientes/$patientId/anamneses/$formId" params={{ patientId, formId: form.id }}>Preencher agora</Link></Button>
          </div>
        </div>
      ))}
      {link && <Input readOnly value={link} aria-label="Link da anamnese" className="mt-3" onFocus={(event) => event.target.select()} />}
    </section>
  );
}
