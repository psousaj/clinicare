/** Search normalization rules are versioned so indexes remain reproducible. */
export const SEARCH_NORMALIZATION_VERSION = 1;

function stringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export function normalizeEmail(value: unknown): string | null {
  const normalized = stringValue(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function normalizePhone(value: unknown): string | null {
  const normalized = stringValue(value)?.replace(/\D/g, '') ?? '';
  return normalized.length ? normalized : null;
}

export function normalizeCpf(value: unknown): string | null {
  const normalized = stringValue(value)?.replace(/\D/g, '') ?? '';
  if (!normalized) return null;
  if (normalized.length !== 11) throw new Error('CPF deve conter exatamente 11 dígitos.');
  return normalized;
}
