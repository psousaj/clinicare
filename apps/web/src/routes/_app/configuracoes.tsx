import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { BadgeCheck, FileText, History, Stamp } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { Field } from '@/components/Field';
import { Button } from '@/components/ui/button';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { professionalProfileQuery, sessionQuery, useSaveProfessionalProfile } from '@/lib/queries';

export const Route = createFileRoute('/_app/configuracoes')({ component: Settings });

const COUNCILS = ['CRM', 'CRO', 'CREFITO', 'CRF', 'COREN', 'CRBM', 'CRBio', 'OUTRO'] as const;
const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

// Configurações da clínica: identidade profissional do usuário logado.
// O registro aqui é o carimbo que a materialização grava nos contratos
// (placeholders professional.*) — sem ele, a geração do DOCX falha.
function Settings() {
  const profile = useQuery(professionalProfileQuery);
  const session = useQuery(sessionQuery);
  const save = useSaveProfessionalProfile();
  const [council, setCouncil] = useState('');
  const [number, setNumber] = useState('');
  const [state, setState] = useState('');

  useEffect(() => {
    if (!profile.data) return;
    setCouncil(profile.data.registrationType ?? '');
    setNumber(profile.data.registrationNumber ?? '');
    setState(profile.data.registrationState ?? '');
  }, [profile.data]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save.mutateAsync({ registrationType: council, registrationNumber: number.trim(), registrationState: state || null });
  }

  const stampLine = council && number.trim() ? `${council} ${number.trim()}${state ? `/${state}` : ''}` : null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
      <section className="panel grid gap-4">
        <div className="panel-header">
          <div>
            <div className="section-kicker">IDENTIDADE PROFISSIONAL</div>
            <h2>Registro no conselho</h2>
          </div>
          {profile.data ? <StatusBadge tone="success">Ativo</StatusBadge> : <StatusBadge tone="warning">Sem registro</StatusBadge>}
        </div>
        <p className="section-note m-0">
          Este registro carimba os contratos gerados para os pacientes. Sem um profissional habilitado,
          a geração do documento falha e o acompanhamento fica parado em “Gerando documento”.
        </p>
        <QueryError query={profile} />
        {profile.isSuccess && (
          <form className="grid gap-4" onSubmit={(event) => submit(event).catch(() => undefined)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Conselho">
                <NativeSelect aria-label="Conselho" required value={council} onChange={(event) => setCouncil(event.target.value)}>
                  <NativeSelectOption value="">Selecione…</NativeSelectOption>
                  {COUNCILS.map((option) => <NativeSelectOption key={option} value={option}>{option}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
              <Field label="Número do registro" name="registrationNumber" required value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Ex.: 123456" />
            </div>
            <div className="grid gap-4 sm:max-w-[calc(50%-8px)]">
              <Field label="UF (opcional)">
                <NativeSelect aria-label="UF" value={state} onChange={(event) => setState(event.target.value)}>
                  <NativeSelectOption value="">Sem UF</NativeSelectOption>
                  {STATES.map((option) => <NativeSelectOption key={option} value={option}>{option}</NativeSelectOption>)}
                </NativeSelect>
              </Field>
            </div>
            <div>
              <Button type="submit" disabled={save.isPending} className="transition-transform duration-150 ease-out active:scale-[0.97]">
                {save.isPending ? 'Salvando…' : 'Salvar registro'}
              </Button>
            </div>
          </form>
        )}
        <div className="grid gap-2">
          <span className="section-kicker">ONDE ESTE REGISTRO APARECE</span>
          <ul className="m-0 grid list-none gap-1 p-0 text-xs text-muted-foreground">
            <li className="flex items-center gap-2"><FileText className="size-3.5" /> Contratos materializados · campos professional.name e professional.registration</li>
            <li className="flex items-center gap-2"><History className="size-3.5" /> Histórico de assinaturas · representante da clínica</li>
            <li className="flex items-center gap-2"><BadgeCheck className="size-3.5" /> Geração do documento · bloqueada enquanto não houver profissional habilitado</li>
          </ul>
        </div>
      </section>
      <aside className="panel grid gap-2 lg:sticky lg:top-4" aria-label="Prévia do carimbo">
        <div className="panel-header"><div><div className="section-kicker">PRÉVIA</div><h2>Seu carimbo</h2></div></div>
        {stampLine ? (
          <div className="stamp-preview" role="status" key="filled">
            <Stamp className="size-4" aria-hidden="true" />
            <strong>{session.data?.user.name ?? 'Profissional'}</strong>
            <span>{stampLine}</span>
          </div>
        ) : (
          <p className="stamp-preview is-empty" role="status" key="empty">Preencha o conselho e o número para ver o carimbo.</p>
        )}
        <p className="m-0 text-xs text-muted-foreground">É assim que sua identificação sai impressa no contrato do paciente.</p>
      </aside>
    </div>
  );
}
