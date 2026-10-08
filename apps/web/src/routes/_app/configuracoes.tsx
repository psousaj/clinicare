import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { BadgeCheck, FileText, History, PenLine, Settings2, Stamp, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { QueryError } from '@/components/QueryState';
import { StatusBadge } from '@/components/StatusBadge';
import { Field } from '@/components/Field';
import { Button } from '@/components/ui/button';
import { SignaturePadField, type SignaturePadHandle } from '@/components/signing/SignaturePadField';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { defaultSignatureQuery, professionalProfileQuery, accountQuery, sessionQuery, useSaveDefaultSignature, useSaveProfessionalProfile, useUpdateAccount } from '@/lib/queries';

export const Route = createFileRoute('/_app/configuracoes')({ component: Settings });

const COUNCILS = ['CRM', 'CRO', 'CREFITO', 'CRF', 'COREN', 'CRBM', 'CRBio', 'OUTRO'] as const;
const STATES = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

// Configurações da clínica: identidade profissional do usuário logado.
// O registro aqui é o carimbo que a materialização grava nos contratos
// (placeholders professional.*) — sem ele, a geração do DOCX falha.
function Settings() {
  const profile = useQuery(professionalProfileQuery);
  const session = useQuery(sessionQuery);
  const defaultSignature = useQuery(defaultSignatureQuery);
  const saveDefaultSignature = useSaveDefaultSignature();
  const signaturePad = useRef<SignaturePadHandle>(null);
  const [signaturePng, setSignaturePng] = useState<string | null>(null);
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

  useEffect(() => {
    if (defaultSignature.data) setSignaturePng(defaultSignature.data.signaturePng);
  }, [defaultSignature.data]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save.mutateAsync({ registrationType: council, registrationNumber: number.trim(), registrationState: state || null });
  }

  const stampLine = council && number.trim() ? `${council} ${number.trim()}${state ? `/${state}` : ''}` : null;

  return (
    <Tabs defaultValue="identity" className="items-stretch">
      <TabsList aria-label="Seções de configurações">
        <TabsTrigger value="account"><Settings2 aria-hidden="true" /> Clínica e conta</TabsTrigger>
        <TabsTrigger value="identity"><UserRound aria-hidden="true" /> Identidade profissional</TabsTrigger>
        <TabsTrigger value="signature"><PenLine aria-hidden="true" /> Assinatura</TabsTrigger>
      </TabsList>

      <TabsContent value="account">
        <ClinicAccountPanel />
      </TabsContent>

      <TabsContent value="signature">
      <section className="panel grid gap-4" aria-label="Assinatura padrão">
        <div className="panel-header">
          <div><div className="section-kicker">ASSINATURA PADRÃO</div><h2>Desenhe uma vez</h2></div>
          <StatusBadge tone={signaturePng ? 'success' : 'warning'}>{signaturePng ? 'Salva' : 'Não configurada'}</StatusBadge>
        </div>
        <p className="section-note m-0">Sua assinatura fica salva nesta conta e aparece pronta nos próximos documentos. Você ainda pode desenhar outra durante qualquer assinatura.</p>
        <SignaturePadField ref={signaturePad} initialImage={signaturePng} onStroke={setSignaturePng} label="Área para desenhar sua assinatura padrão" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => { signaturePad.current?.clear(); setSignaturePng(null); }}>Limpar</Button>
          <Button type="button" disabled={saveDefaultSignature.isPending || defaultSignature.isLoading} onClick={() => saveDefaultSignature.mutate(signaturePng)}>
            {saveDefaultSignature.isPending ? 'Salvando…' : 'Salvar assinatura padrão'}
          </Button>
        </div>
      </section>
      </TabsContent>

      <TabsContent value="identity">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
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
      </TabsContent>
    </Tabs>
  );
}

// Clínica e conta: nome da clínica (topo, contratos, identidade pública)
// e nome do responsável (carimbo, assinaturas, histórico). E-mail e senha
// continuam gerenciados pelos comandos administrativos; o bootstrap via
// env só provisiona na primeira criação e não sobrescreve estes nomes.
function ClinicAccountPanel() {
  const account = useQuery(accountQuery);
  const save = useUpdateAccount();
  const [clinicName, setClinicName] = useState('');
  const [adminName, setAdminName] = useState('');

  useEffect(() => {
    if (!account.data) return;
    setClinicName(account.data.tenant.name ?? '');
    setAdminName(account.data.user.name ?? '');
  }, [account.data]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await save.mutateAsync({ name: adminName.trim(), clinicName: clinicName.trim() });
  }

  return (
    <section className="panel grid gap-4" aria-label="Clínica e conta">
      <div className="panel-header">
        <div>
          <div className="section-kicker">CLÍNICA E CONTA</div>
          <h2>Nome da clínica e do responsável</h2>
        </div>
      </div>
      <p className="section-note m-0">
        Estes nomes aparecem no topo do painel, nos contratos e no carimbo profissional.
      </p>
      <QueryError query={account} />
      {account.isSuccess && (
        <form className="grid gap-4" onSubmit={(event) => submit(event).catch(() => undefined)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da clínica" name="clinicName" required minLength={2} value={clinicName} onChange={(event) => setClinicName(event.target.value)} placeholder="Ex.: Espaço Vida" />
            <Field label="Nome do responsável" name="adminName" required minLength={2} value={adminName} onChange={(event) => setAdminName(event.target.value)} placeholder="Ex.: Dra. Ana Souza" />
          </div>
          <p className="section-note m-0">Acesso: {account.data.user.email ?? '—'} (e-mail e senha não mudam por aqui).</p>
          <div>
            <Button type="submit" disabled={save.isPending} className="transition-transform duration-150 ease-out active:scale-[0.97]">
              {save.isPending ? 'Salvando…' : 'Salvar nomes'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
