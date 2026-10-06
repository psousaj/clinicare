import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check, FileUp, Upload } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { ApiError } from '@/lib/api';
import { combosQuery, contractPlaceholdersQuery, proceduresQuery, usePresignContractVersionPdf, usePublishContractDraft, useSaveContractDraft } from '@/lib/queries';
import type { Contract } from '@/lib/schemas';

export type ContractMetadata = { title: string; kind: Contract['kind']; procedureId: string | null; comboId: string | null; active?: boolean };

type Props = {
  heading: string;
  submitLabel: string;
  initial?: Partial<ContractMetadata>;
  notice?: ReactNode;
  actions?: ReactNode;
  saving?: boolean;
  onSave: (data: ContractMetadata) => Promise<unknown>;
  contract?: Contract;
};

const CONTEXTS = ['patient', 'professional', 'clinic', 'application', 'plan'] as const;
const contextLabel = (key: string) => ({ patient: 'Paciente', professional: 'Profissional', clinic: 'Clínica', application: 'Aplicação', plan: 'Plano' })[key] ?? key;
const contextDescription = (key: string) => ({
  patient: 'Nome, CPF e data de nascimento',
  professional: 'Nome e registro profissional',
  clinic: 'Nome da clínica',
  application: 'Data de aplicação do contrato',
  plan: 'Procedimentos incluídos no plano',
})[key] ?? '';

// Cadastro/edição de contrato no modelo DOCX (ADR-0005): metadados no topo,
// draft DOCX + placeholders + publish gerando versões imutáveis.
export function ContractFormPage({ heading, submitLabel, initial = {}, notice, actions, saving, onSave, contract }: Props) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [kind, setKind] = useState<Contract['kind']>(initial.kind ?? 'standard');
  const [procedureId, setProcedureId] = useState(initial.procedureId ?? '');
  const [comboId, setComboId] = useState(initial.comboId ?? '');
  const procedures = useQuery(proceduresQuery).data ?? [];
  const combos = useQuery(combosQuery).data ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (title.trim().length < 2) throw new Error('Informe o nome do contrato.');
      if (kind === 'procedure' && !procedureId) throw new Error('Escolha o procedimento deste contrato.');
      if (kind === 'combo' && !comboId) throw new Error('Escolha o combo deste contrato.');
      await onSave({ title: title.trim(), kind, procedureId: kind === 'procedure' ? procedureId : null, comboId: kind === 'combo' ? comboId : null });
    } catch (error) {
      if (!(error instanceof ApiError)) toast.error((error as Error).message);
    }
  }

  return (
    <form className="contract-form-page grid gap-4" onSubmit={submit} noValidate>
      <section className="panel contract-settings-panel grid gap-4">
        <div className="panel-header form-page-header">
          <div>
            <Link to="/contratos" className="text-button mb-2"><ArrowLeft size={14} /> Contratos</Link>
            <h2>{heading}</h2>
          </div>
          <div className="form-page-actions">
            {actions && <div className="form-page-extra-actions">{actions}</div>}
            <Button type="button" variant="outline" asChild><Link to="/contratos">Cancelar</Link></Button>
            <Button type="submit" disabled={saving}>{submitLabel}</Button>
          </div>
        </div>
        {notice && <div className="contract-notice">{notice}</div>}
        <div className="contract-metadata-grid grid max-w-3xl gap-4 sm:grid-cols-2">
          <Label className="flex-col items-stretch gap-1.5">
            Nome do contrato
            <Input value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus={!initial.title} placeholder="Ex.: Contrato padrão de serviços" />
          </Label>
          <Label className="flex-col items-stretch gap-1.5">
            Aplicação
            <NativeSelect value={kind} onChange={(event) => setKind(event.target.value as Contract['kind'])}>
              <NativeSelectOption value="standard">Padrão (todo acompanhamento)</NativeSelectOption>
              <NativeSelectOption value="procedure">Específico de procedimento</NativeSelectOption>
              <NativeSelectOption value="combo">Específico de combo</NativeSelectOption>
            </NativeSelect>
          </Label>
          {kind === 'procedure' && (
            <Label className="flex-col items-stretch gap-1.5 sm:col-span-2">
              Procedimento
              <NativeSelect value={procedureId} onChange={(event) => setProcedureId(event.target.value)}>
                <NativeSelectOption value="">Selecione…</NativeSelectOption>
                {procedures.map((procedure) => <NativeSelectOption key={procedure.id} value={procedure.id}>{procedure.name}</NativeSelectOption>)}
              </NativeSelect>
            </Label>
          )}
          {kind === 'combo' && (
            <Label className="flex-col items-stretch gap-1.5 sm:col-span-2">
              Combo
              <NativeSelect value={comboId} onChange={(event) => setComboId(event.target.value)}>
                <NativeSelectOption value="">Selecione…</NativeSelectOption>
                {combos.map((combo) => <NativeSelectOption key={combo.id} value={combo.id}>{combo.name}</NativeSelectOption>)}
              </NativeSelect>
            </Label>
          )}
        </div>
      </section>
      {contract && <ContractDraftPanel contract={contract} />}
    </form>
  );
}

function ContractDraftPanel({ contract }: { contract: Contract }) {
  const placeholders = useQuery(contractPlaceholdersQuery).data ?? [];
  const [file, setFile] = useState<File | null>(null);
  const [contexts, setContexts] = useState<Record<string, { enabled: boolean; required: boolean }>>(() =>
    Object.fromEntries(CONTEXTS.map((key) => [key, { ...(contract.draftContextConfiguration?.[key] ?? { enabled: false, required: false }) }])) as Record<string, { enabled: boolean; required: boolean }>,
  );
  const [allowed, setAllowed] = useState<string[]>(contract.draftAllowedPlaceholders ?? []);
  const [required, setRequired] = useState<string[]>(contract.draftRequiredPlaceholders ?? []);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const saveDraft = useSaveContractDraft();
  const publish = usePublishContractDraft();
  const attachPdf = usePresignContractVersionPdf();
  const current = contract.versions.at(-1);

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section className="panel contract-content-panel grid gap-3">
        <h3 className="m-0 text-base font-semibold">Draft DOCX</h3>
        <p className="m-0 text-sm text-muted-foreground">
          {contract.draftDocxHash ? `Draft salvo · hash ${contract.draftDocxHash.slice(0, 12)}… · ${contract.draftDocxSize ?? '?'} bytes.` : 'Nenhum draft enviado. Envie o .docx do modelo.'}
        </p>
        <Label className="flex-col items-stretch gap-1.5">
          Arquivo .docx
          <Input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Label>
        <fieldset className="contract-fieldset">
          <legend>Dados usados no documento</legend>
          <p>Escolha quais informações podem preencher os campos entre chaves no DOCX.</p>
          <div className="contract-context-grid">
            {CONTEXTS.map((key) => (
              <label key={key} className={`contract-context-card${contexts[key]?.enabled ? ' is-enabled' : ''}`}>
                <input type="checkbox" checked={contexts[key]?.enabled ?? false} onChange={(event) => setContexts((prev) => ({ ...prev, [key]: { enabled: event.target.checked, required: event.target.checked ? prev[key]?.required ?? false : false } }))} />
                <span className="contract-context-copy"><strong>{contextLabel(key)}</strong><small>{contextDescription(key)}</small></span>
                <span className="contract-context-required">
                  <input type="checkbox" disabled={!contexts[key]?.enabled} checked={contexts[key]?.required ?? false} onChange={(event) => setContexts((prev) => ({ ...prev, [key]: { enabled: prev[key]?.enabled ?? false, required: event.target.checked } }))} />
                  <small>Obrigatório</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="contract-fieldset">
          <legend>Campos do documento</legend>
          <p>Permita apenas os campos que realmente aparecem no arquivo. Marque como obrigatório quando não puder ficar vazio.</p>
          {placeholders.length ? (
            <div className="contract-placeholder-list">
              {placeholders.map((placeholder) => {
                const enabled = allowed.includes(placeholder);
                return (
                  <div key={placeholder} className={`contract-placeholder-row${enabled ? ' is-enabled' : ''}`}>
                    <label className="contract-placeholder-main">
                      <input type="checkbox" checked={enabled} onChange={() => { setAllowed((prev) => toggle(prev, placeholder)); if (enabled) setRequired((prev) => prev.filter((item) => item !== placeholder)); }} />
                      <code>{`{${placeholder}}`}</code>
                    </label>
                    <label className="contract-required-toggle"><input type="checkbox" aria-label={`${placeholder} obrigatório`} disabled={!enabled} checked={required.includes(placeholder)} onChange={() => setRequired((prev) => toggle(prev, placeholder))} /> Obrigatório</label>
                  </div>
                );
              })}
            </div>
          ) : <p className="contract-inline-empty">Carregando os campos disponíveis…</p>}
        </fieldset>
        <div className="contract-workflow-actions">
          <Button type="button" disabled={!file || saveDraft.isPending || !placeholders.length} onClick={() => file && saveDraft.mutate({ id: contract.id, file, contexts, allowedPlaceholders: allowed, requiredPlaceholders: required })}>
            <Upload /> {saveDraft.isPending ? 'Enviando draft…' : 'Salvar draft'}
          </Button>
          <Button type="button" variant="outline" disabled={!contract.draftDocxHash || publish.isPending} onClick={() => publish.mutate(contract.id)}>
            <Check /> {publish.isPending ? 'Publicando…' : `Publicar v${(contract.currentVersion ?? 0) + 1}`}
          </Button>
        </div>
      </section>
      <section className="panel contract-preview-panel grid gap-3" aria-label="Versões publicadas">
        <h3 className="m-0 text-base font-semibold">Versões publicadas</h3>
        {current ? (
          <p className="m-0 text-sm text-muted-foreground">
            Atual v{current.version} · {current.hasSourceDocx ? 'fonte DOCX congelada' : 'sem DOCX'} · {current.hasRenderedPdf ? 'PDF anexado' : 'sem PDF'} · {(current.allowedPlaceholders ?? []).length} placeholders permitidos.
          </p>
        ) : (
          <p className="m-0 text-sm text-muted-foreground">Nenhuma versão publicada. O publish cria a v1 imutável usada na materialização do acompanhamento.</p>
        )}
        <div className="grid gap-2">
          {contract.versions.map((version) => (
            <div key={version.version} className="rounded-md border p-3 text-sm">
              <strong>v{version.version}</strong> · {version.hasSourceDocx ? 'DOCX' : 'sem DOCX'} · {version.hasRenderedPdf ? 'PDF' : 'sem PDF'}
              {(version.requiredPlaceholders ?? []).length > 0 && <span> · obrigatórios: {(version.requiredPlaceholders ?? []).join(', ')}</span>}
            </div>
          ))}
        </div>
        {current && !current.hasRenderedPdf && (
          <div className="grid gap-2">
            <Label className="flex-col items-stretch gap-1.5">
              PDF da versão atual (opcional)
              <Input type="file" accept="application/pdf" onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)} />
            </Label>
            <Button type="button" variant="outline" disabled={!pdfFile || attachPdf.isPending} onClick={() => pdfFile && attachPdf.mutate({ id: contract.id, file: pdfFile })}>
              <FileUp /> Anexar PDF
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
