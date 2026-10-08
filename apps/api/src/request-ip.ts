import { isIP } from 'node:net';

type RuntimeServer = {
  requestIP?: (request: Request) => { address?: unknown } | null;
};

const validIp = (value: string | null | undefined) => {
  const candidate = value?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : undefined;
};

export function observedClientIp(request: Request, env: unknown, trustedProxyIps = process.env.TRUSTED_PROXY_IPS?.split(',').map((value) => value.trim()).filter(Boolean) ?? []) {
  const server = env && typeof env === 'object' && 'server' in env
    ? (env as { server?: RuntimeServer }).server
    : undefined;
  const directIp = validIp(typeof server?.requestIP === 'function' ? server.requestIP(request)?.address as string | undefined : undefined);

  if (directIp && trustedProxyIps.includes(directIp)) {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]
      ?? request.headers.get('cf-connecting-ip');
    const proxiedIp = validIp(forwarded);
    if (proxiedIp) return proxiedIp;
  }

  return directIp;
}
