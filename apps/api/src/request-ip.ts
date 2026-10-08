import { isIP } from 'node:net';

type RuntimeServer = {
  requestIP?: (request: Request) => { address?: unknown } | null;
};

const validIp = (value: unknown) => typeof value === 'string' && value.trim() && isIP(value.trim()) !== 0 ? value.trim() : undefined;

export function observedClientIp(request: Request, env: unknown) {
  const server = env && typeof env === 'object' && 'server' in env
    ? (env as { server?: RuntimeServer }).server
    : undefined;
  return validIp(typeof server?.requestIP === 'function' ? server.requestIP(request)?.address : undefined);
}
