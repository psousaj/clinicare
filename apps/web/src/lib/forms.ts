import { z } from 'zod';

const text = (label: string) => z.string().trim().min(1, `${label} é obrigatório.`);
const optionalText = z.string().trim().transform((value) => value || null);
const reais = (label: string, min = 0) => z.coerce.number({ error: `${label} inválido.` }).min(min, `${label} inválido.`).transform((value) => Math.round(value * 100));
const optionalReais = z.string().trim().transform((value) => (value ? Math.round(Number(value) * 100) : null)).refine((value) => value === null || Number.isFinite(value), 'Valor promocional inválido.');
const optionalInt = z.string().trim().transform((value) => Number(value) || null);

export const patientForm = z.object({ fullName: text('Nome'), phone: optionalText, notes: optionalText, email: z.string().trim().pipe(z.union([z.literal(''), z.email('E-mail inválido.')])).transform((value) => value || null) });
export const procedureForm = z.object({
  name: text('Nome'),
  description: optionalText,
  baseSessions: optionalInt,
  durationMinutes: z.coerce.number().int('Duração inválida.').min(1, 'Informe a duração em minutos.'),
  price: reais('Preço'),
});
export const anamnesisForm = z.object({ title: text('Nome do formulário') });
export const comboForm = z.object({
  name: text('Nome'),
  description: optionalText,
  price: reais('Preço'),
  promo: optionalReais,
  validFrom: optionalText,
  validUntil: optionalText,
});
export const planForm = z.object({ name: text('Nome'), description: optionalText, price: reais('Preço'), durationDays: optionalInt, validityDays: optionalInt });
export const followupForm = z.object({ patientId: text('Paciente'), offer: z.string().regex(/^(procedure|combo|plan):.+$/, 'Escolha um procedimento, combo ou plano.') });
export const appointmentForm = z.object({ patientId: text('Paciente') });
export const paymentForm = z.object({ amount: reais('Valor', 0.01), method: z.enum(['pix', 'cash', 'credit_card']), installments: z.coerce.number().int().min(1).default(1) });

export function parseForm<S extends z.ZodType>(schema: S, form: FormData): z.output<S> {
  const result = schema.safeParse(Object.fromEntries([...form.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : ''])));
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? 'Dados inválidos.');
  return result.data;
}
