export type FieldKind = 'text' | 'longtext' | 'number' | 'digits' | 'date' | 'time' | 'phone' | 'email' | 'cpf' | 'boolean' | 'choice' | 'multi' | 'scale';
export type SchemaField = Record<string, unknown> & { title?: string; type?: string; 'x-kind'?: FieldKind };
export type FormSchema = { type?: string; required?: string[]; properties?: Record<string, SchemaField> };

export const TIME_PATTERN = '^([01]\\d|2[0-3]):[0-5]\\d$';
export const PHONE_PATTERN = '^\\(\\d{2}\\) \\d{4,5}-\\d{4}$';
export const CPF_PATTERN = '^\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}$';
export const DEFAULT_OPTIONS = ['Opção 1', 'Opção 2'];

export const fieldKinds: { kind: FieldKind; label: string }[] = [
  { kind: 'text', label: 'Texto curto' },
  { kind: 'longtext', label: 'Texto longo' },
  { kind: 'number', label: 'Número' },
  { kind: 'digits', label: 'Apenas dígitos' },
  { kind: 'date', label: 'Data' },
  { kind: 'time', label: 'Hora' },
  { kind: 'phone', label: 'Telefone' },
  { kind: 'email', label: 'E-mail' },
  { kind: 'cpf', label: 'CPF' },
  { kind: 'boolean', label: 'Sim/não' },
  { kind: 'choice', label: 'Escolha única' },
  { kind: 'multi', label: 'Múltipla escolha' },
  { kind: 'scale', label: 'Escala de 0 a 10' },
];

export const hasOptions = (kind: FieldKind) => kind === 'choice' || kind === 'multi';

export function buildField(kind: FieldKind, title: string, options: string[] = DEFAULT_OPTIONS): SchemaField {
  const base = { title, 'x-kind': kind };
  switch (kind) {
    case 'number': return { ...base, type: 'number' };
    case 'digits': return { ...base, type: 'string', pattern: '^\\d+$' };
    case 'date': return { ...base, type: 'string', format: 'date' };
    case 'time': return { ...base, type: 'string', pattern: TIME_PATTERN };
    case 'phone': return { ...base, type: 'string', pattern: PHONE_PATTERN };
    case 'email': return { ...base, type: 'string', format: 'email' };
    case 'cpf': return { ...base, type: 'string', pattern: CPF_PATTERN };
    case 'boolean': return { ...base, type: 'boolean' };
    case 'choice': return { ...base, type: 'string', enum: options };
    case 'multi': return { ...base, type: 'array', uniqueItems: true, items: { type: 'string', enum: options } };
    case 'scale': return { ...base, type: 'integer', minimum: 0, maximum: 10 };
    default: return { ...base, type: 'string' };
  }
}

// Formulários salvos antes dos tipos novos só têm `type`.
export function kindOf(field: SchemaField): FieldKind {
  if (field['x-kind']) return field['x-kind'];
  if (field.type === 'number') return 'number';
  if (field.type === 'boolean') return 'boolean';
  return 'text';
}

export function optionsOf(field: SchemaField): string[] {
  const items = field.items as { enum?: string[] } | undefined;
  return (field.enum as string[] | undefined) ?? items?.enum ?? [];
}

export function formatDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function formatPhone(value: string) {
  const digits = formatDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  const split = digits.length > 10 ? 7 : 6;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}${digits.length > split ? `-${digits.slice(split)}` : ''}`;
}

export function formatCpf(value: string) {
  const digits = formatDigits(value).slice(0, 11);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join('.') + (digits.length > 9 ? `-${digits.slice(9)}` : '');
}

export function isValidCpf(value: string) {
  const digits = formatDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number) => {
    const sum = Array.from(digits.slice(0, length), (digit, index) => Number(digit) * (length + 1 - index)).reduce((total, part) => total + part, 0);
    return ((sum * 10) % 11) % 10;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

// Retorna a primeira inconsistência do formulário montado, ou null quando está pronto para salvar.
export function validateFormSchema(schema: FormSchema, { requireFields = true } = {}): string | null {
  const fields = Object.values(schema.properties ?? {});
  if (requireFields && !fields.length) return 'Adicione ao menos um campo.';
  if (fields.some((field) => !field.title?.trim())) return 'Todos os campos precisam de um nome.';
  for (const field of fields) {
    if (!hasOptions(kindOf(field))) continue;
    const options = optionsOf(field).map((option) => option.trim());
    if (options.length < 2 || options.some((option) => !option)) return `Preencha ao menos duas opções em “${field.title}”.`;
    if (new Set(options).size !== options.length) return `“${field.title}” tem opções repetidas.`;
  }
  return null;
}
