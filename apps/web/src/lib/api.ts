import { z } from 'zod';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
function withIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withIds);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const entries = Object.entries(value).map(([key, item]) => [key, withIds(item)] as const);
    const record = Object.fromEntries(entries);
    if (typeof record._id === 'string' && record.id === undefined) record.id = record._id;
    if (record.id === undefined && typeof record._id === 'object' && record._id && 'id' in record._id) record.id = record._id.id;
    if (record.id === undefined && typeof record._id === 'object' && record._id && '$oid' in record._id) record.id = record._id.$oid;
    return record;
  }
  return value;
}
type RequestOptions<S extends z.ZodType> = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; schema: S; fallbackError?: string };
export async function api<S extends z.ZodType>(path: string, { method = 'GET', body, schema, fallbackError = 'Não foi possível concluir.' }: RequestOptions<S>): Promise<z.output<S>> {
  const response = await fetch(path, { method, credentials: 'include', headers: body === undefined ? undefined : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError((data as { error?: string } | null)?.error ?? fallbackError, response.status);
  const parsed = schema.safeParse(withIds(data));
  if (!parsed.success) throw new ApiError('Resposta inesperada do servidor.', response.status);
  return parsed.data;
}
