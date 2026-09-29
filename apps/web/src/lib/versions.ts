import type { AnamnesisVersion } from '@/lib/schemas';

export function originLabel(version: AnamnesisVersion) {
  if (version.origin === 'restored') return `Rollback da v${version.restoredFromVersion}`;
  return version.origin === 'edited' ? 'Editada' : 'Criada';
}

export const fieldCount = (version: AnamnesisVersion) => Object.keys((version.schema as { properties?: object }).properties ?? {}).length;

// Ignora `required: []`, que o editor acrescenta ao mexer em campos.
export function sameSchema(a: Record<string, unknown>, b: Record<string, unknown>) {
  const normalize = (schema: Record<string, unknown>) => JSON.stringify({ ...schema, required: (schema.required as string[] | undefined)?.length ? schema.required : undefined });
  return normalize(a) === normalize(b);
}
