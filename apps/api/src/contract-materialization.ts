import { createHash } from 'node:crypto';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { buildProtectedAad, decryptValue, encryptValue } from '@clinicare/db';

export const CONTRACT_CONTEXT_INCOMPLETE = 'CONTRACT_CONTEXT_INCOMPLETE';
export const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PDF_CONTENT_TYPE = 'application/pdf';

export const PLACEHOLDERS = [
  'patient.name',
  'patient.cpf',
  'patient.birthDate',
  'professional.name',
  'professional.registration',
  'clinic.name',
  'application.date',
  'plan.procedures',
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];
export type MaterializationContext = {
  patient?: { name?: string | null; cpf?: string | null; birthDate?: string | null };
  professional?: { name?: string | null; registration?: string | null };
  clinic?: { name?: string | null };
  application?: { date?: string | null };
  plan?: { procedures?: string[] | null };
};
export type ContextConfiguration = Record<'patient' | 'professional' | 'clinic' | 'application' | 'plan', { enabled: boolean; required: boolean }>;

const PLACEHOLDER_CONTEXT: Record<Placeholder, keyof MaterializationContext> = {
  'patient.name': 'patient', 'patient.cpf': 'patient', 'patient.birthDate': 'patient',
  'professional.name': 'professional', 'professional.registration': 'professional',
  'clinic.name': 'clinic', 'application.date': 'application', 'plan.procedures': 'plan',
};
const invalid = (message: string, code = 'CONTRACT_TEMPLATE_INVALID') => Object.assign(new Error(message), { code, status: 400 });

export function defaultContextConfiguration(): ContextConfiguration {
  return { patient: { enabled: false, required: false }, professional: { enabled: false, required: false }, clinic: { enabled: false, required: false }, application: { enabled: false, required: false }, plan: { enabled: false, required: false } };
}

export function validateContextConfiguration(value: unknown): ContextConfiguration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('A configuração de contextos é inválida.');
  const result = defaultContextConfiguration();
  for (const key of Object.keys(result) as Array<keyof ContextConfiguration>) {
    const item = (value as Record<string, unknown>)[key];
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof (item as any).enabled !== 'boolean' || typeof (item as any).required !== 'boolean') throw invalid(`A configuração do contexto ${key} é inválida.`);
    if ((item as any).required && !(item as any).enabled) throw invalid(`O contexto ${key} não pode ser obrigatório quando está desabilitado.`);
    result[key] = { enabled: (item as any).enabled, required: (item as any).required };
  }
  for (const key of Object.keys(value as object)) if (!(key in result)) throw invalid(`Contexto desconhecido: ${key}.`);
  return result;
}

export function validatePlaceholderConfiguration(contexts: unknown, allowed: unknown, required: unknown) {
  const config = validateContextConfiguration(contexts);
  if (!Array.isArray(allowed) || !Array.isArray(required)) throw invalid('A configuração de placeholders é inválida.');
  const allowedSet = new Set(allowed);
  const requiredSet = new Set(required);
  for (const placeholder of [...allowed, ...required]) {
    if (typeof placeholder !== 'string' || !(PLACEHOLDERS as readonly string[]).includes(placeholder)) throw invalid(`Placeholder desconhecido: ${String(placeholder)}.`);
  }
  if (allowedSet.size !== allowed.length || requiredSet.size !== required.length) throw invalid('Placeholders duplicados não são permitidos.');
  for (const placeholder of requiredSet) {
    if (!allowedSet.has(placeholder)) throw invalid(`Placeholder obrigatório não permitido: ${placeholder}.`);
    const context = PLACEHOLDER_CONTEXT[placeholder as Placeholder];
    if (!config[context].enabled || !config[context].required) throw invalid(`Placeholder obrigatório exige contexto obrigatório habilitado: ${placeholder}.`);
  }
  for (const placeholder of allowedSet) if (!config[PLACEHOLDER_CONTEXT[placeholder as Placeholder]].enabled) throw invalid(`Placeholder exige contexto habilitado: ${placeholder}.`);
  return { contexts: config, allowedPlaceholders: [...allowedSet] as Placeholder[], requiredPlaceholders: [...requiredSet] as Placeholder[] };
}

function xmlText(xml: string) {
  return xml.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
}
function extractTags(xml: string): string[] {
  const text = xmlText(xml);
  const tags: string[] = [];
  const pattern = /{\s*([#^/]?)\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*}/g;
  for (const match of text.matchAll(pattern)) {
    const prefix = match[1] ?? '';
    const tag = match[2]!;
    if (tag !== '.') tags.push(`${prefix}${tag}`);
  }
  // Word may split a placeholder across multiple runs. Removing XML tags above
  // makes the common split-run representation contiguous before validation.
  return tags;
}

export function inspectDocxPlaceholders(bytes: Uint8Array): string[] {
  let zip: any;
  try { zip = new PizZip(bytes); } catch { throw invalid('O arquivo DOCX é inválido.'); }
  const documentXml = zip.file('word/document.xml')?.asText() ?? '';
  const allXml = Object.keys(zip.files).filter((name) => /^word\/(document|header|footer)\d*\.xml$/.test(name)).map((name) => zip.file(name)?.asText() ?? '').join('\n');
  if (!documentXml) throw invalid('O arquivo DOCX não possui o documento principal.');
  return [...new Set(extractTags(allXml))];
}

export function validateDocxPlaceholders(bytes: Uint8Array, contexts: unknown, allowed: unknown, required: unknown) {
  const configuration = validatePlaceholderConfiguration(contexts, allowed, required);
  const tags = inspectDocxPlaceholders(bytes);
  for (const tag of tags) {
    const normalized = tag.replace(/^[#^/]/, '');
    if (!(PLACEHOLDERS as readonly string[]).includes(normalized)) throw invalid(`Placeholder desconhecido no DOCX: ${normalized}.`);
    if (!configuration.allowedPlaceholders.includes(normalized as Placeholder)) throw invalid(`Placeholder não permitido no DOCX: ${normalized}.`);
  }
  return { ...configuration, discoveredPlaceholders: tags };
}

function values(context: MaterializationContext): Record<string, unknown> {
  return {
    patient: { name: context.patient?.name ?? '', cpf: context.patient?.cpf ?? '', birthDate: context.patient?.birthDate ?? '' },
    professional: { name: context.professional?.name ?? '', registration: context.professional?.registration ?? '' },
    clinic: { name: context.clinic?.name ?? '' },
    application: { date: context.application?.date ?? '' },
    plan: { procedures: context.plan?.procedures ?? [] },
  };
}
function hasValue(context: MaterializationContext, placeholder: Placeholder) {
  if (placeholder === 'plan.procedures') return Array.isArray(context.plan?.procedures) && context.plan.procedures.length > 0;
  const [contextKey, field] = placeholder.split('.') as [keyof MaterializationContext, string];
  return Boolean((context[contextKey] as Record<string, unknown> | undefined)?.[field]);
}
export function assertRequiredContext(context: MaterializationContext, required: readonly Placeholder[]) {
  const missing = required.filter((placeholder) => !hasValue(context, placeholder));
  if (missing.length) throw Object.assign(new Error(`${CONTRACT_CONTEXT_INCOMPLETE}: contexto obrigatório ausente: ${missing.join(', ')}.`), { code: CONTRACT_CONTEXT_INCOMPLETE, status: 400, missing });
}

export function renderDocx(template: Uint8Array, context: MaterializationContext, configuration: { contexts: unknown; allowedPlaceholders: unknown; requiredPlaceholders: unknown }): Uint8Array {
  const checked = validatePlaceholderConfiguration(configuration.contexts, configuration.allowedPlaceholders, configuration.requiredPlaceholders);
  const tags = validateDocxPlaceholders(template, checked.contexts, checked.allowedPlaceholders, checked.requiredPlaceholders).discoveredPlaceholders;
  assertRequiredContext(context, checked.requiredPlaceholders);
  const zip = new PizZip(template);
  try {
    const document = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
      delimiters: { start: '{', end: '}' },
      // Placeholders são caminhos (`patient.name`), não chaves literais com
      // ponto. O parser padrão trata o caminho inteiro como uma chave e,
      // silenciosamente, nullGetter substituía tudo por string vazia.
      parser: (tag: string) => ({
        get: (scope: unknown) => {
          if (tag === '.') return scope;
          return tag.split('.').reduce<unknown>((value, key) =>
            value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, scope);
        },
      }),
    });
    document.render(values(context));
    const output = document.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' });
    if (output.byteLength === 0) throw invalid('O DOCX renderizado está vazio.');
    void tags;
    return output;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as any).code === CONTRACT_CONTEXT_INCOMPLETE) throw error;
    throw invalid(error instanceof Error ? error.message : 'Falha ao renderizar o DOCX.');
  }
}

export function encryptMaterializationContext(tenantId: string, contractId: string, context: MaterializationContext) {
  const encrypted = encryptValue(JSON.stringify(context), buildProtectedAad(tenantId, 'followup_contracts', contractId, 'materialization_context'));
  return { ciphertext: encrypted.ciphertext, nonce: encrypted.nonce, keyVersion: encrypted.keyVersion, digest: createHash('sha256').update(JSON.stringify(context)).digest('hex') };
}
export function decryptMaterializationContext(tenantId: string, contractId: string, value: { ciphertext: string; nonce: string; keyVersion: number }): MaterializationContext {
  return JSON.parse(decryptValue(value, buildProtectedAad(tenantId, 'followup_contracts', contractId, 'materialization_context'))) as MaterializationContext;
}
