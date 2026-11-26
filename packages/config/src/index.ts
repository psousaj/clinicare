export function parsePort(value: string | undefined, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} deve ser um número inteiro entre 1 e 65535.`);
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} deve ser um número inteiro entre 1 e 65535.`);
  }
  return port;
}
