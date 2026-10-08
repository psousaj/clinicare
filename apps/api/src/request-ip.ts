import { isIP } from 'node:net';

const validIp = (value: unknown) => typeof value === 'string' && value.trim() && isIP(value.trim()) !== 0 ? value.trim() : undefined;

// The origin is published through Cloudflare Tunnel, not directly to the
// internet. The forwarding headers are therefore the trusted ingress context.
const forwardedParameter = (value: string | null) => value?.split(',')
  .map((part) => part.match(/(?:^|;)\s*for="?\[?([^"\];,]+)\]?/i)?.[1])
  .map(validIp)
  .find((value): value is string => !!value);

const headerAddress = (request: Request, name: string) => {
  const value = request.headers.get(name);
  if (name === 'forwarded') return forwardedParameter(value);
  return value?.split(',').map(validIp).find((candidate): candidate is string => !!candidate);
};

export function observedClientIp(request: Request) {
  for (const header of ['cf-connecting-ip', 'true-client-ip', 'fastly-client-ip', 'x-forwarded-for', 'x-original-forwarded-for', 'forwarded', 'x-real-ip', 'x-client-ip', 'client-ip', 'x-cluster-client-ip', 'x-forwarded']) {
    const ip = headerAddress(request, header);
    if (ip) return ip;
  }
  return undefined;
}
