import { parsePort } from '@clinicare/config';

export function resolveApiPort(value: string | undefined): number {
  return parsePort(value, 'API_PORT', 3000);
}
