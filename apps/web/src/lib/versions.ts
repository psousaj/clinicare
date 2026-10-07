import type { AnamnesisVersion } from '@/lib/schemas';

export type VersionOrigin = { origin?: 'created' | 'edited' | 'restored' | null; restoredFromVersion?: number | null };

export function originLabel(version: VersionOrigin) {
  if (version.origin === 'restored') return `Rollback da v${version.restoredFromVersion}`;
  return version.origin === 'edited' ? 'Editada' : 'Criada';
}

export const fieldCount = (version: AnamnesisVersion) => Object.keys((version.schema as { properties?: object }).properties ?? {}).length;

// Ignora `required: []`, que o editor acrescenta ao mexer em campos, e a
// ordem das chaves de `properties` (o `jsonb` reordena ao persistir; a ordem
// visual vive em `x-propertyOrder` e continua sendo comparada).
export function sameSchema(a: Record<string, unknown>, b: Record<string, unknown>) {
  const normalize = (schema: Record<string, unknown>) => {
    const properties = schema.properties as Record<string, unknown> | undefined;
    const sorted = properties ? Object.fromEntries(Object.keys(properties).sort().map((key) => [key, properties[key]])) : undefined;
    return JSON.stringify({ ...schema, properties: sorted, required: (schema.required as string[] | undefined)?.length ? schema.required : undefined });
  };
  return normalize(a) === normalize(b);
}
