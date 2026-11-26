import { parsePort } from '@clinicare/config';

type Environment = Record<string, string | undefined>;

export function resolveWebPort(env: Environment): number {
  return parsePort(env.WEB_PORT, 'WEB_PORT', 5173);
}

export function resolveApiProxyTarget(rootEnv: Environment, appEnv: Environment, webPort?: number): string {
  const target = rootEnv.VITE_API_PROXY_TARGET?.trim() || appEnv.VITE_API_PROXY_TARGET?.trim();
  const apiPort = parsePort(rootEnv.API_PORT ?? appEnv.API_PORT, 'API_PORT', 3000);
  const resolvedTarget = target || `http://localhost:${apiPort}`;
  if (webPort !== undefined) {
    if (webPort === apiPort) {
      throw new Error('WEB_PORT não pode colidir com API_PORT.');
    }
    const url = new URL(resolvedTarget);
    if (['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0', '[::]', '::'].includes(url.hostname)
      && Number(url.port || (url.protocol === 'https:' ? 443 : 80)) === webPort) {
      throw new Error('WEB_PORT não pode colidir com a porta do destino local da API.');
    }
  }
  return resolvedTarget;
}
