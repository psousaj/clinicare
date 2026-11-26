import { describe, expect, it } from 'vitest';
import { resolveApiProxyTarget, resolveWebPort } from './vite-env';

describe('Vite environment configuration', () => {
  it('uses WEB_PORT for the development server', () => {
    expect(resolveWebPort({ WEB_PORT: '4173' })).toBe(4173);
    expect(resolveWebPort({})).toBe(5173);
  });

  it('gives root WEB_PORT precedence over app-local configuration', () => {
    const appEnv = { WEB_PORT: '4173' };
    const rootEnv = { WEB_PORT: '5173' };
    expect(resolveWebPort({ ...appEnv, ...rootEnv })).toBe(5173);
  });

  it('rejects invalid WEB_PORT values', () => {
    for (const value of ['', '0', '65536', '5173.5', 'invalid']) {
      expect(() => resolveWebPort({ WEB_PORT: value })).toThrow('WEB_PORT');
    }
  });

  it('derives the local API proxy target from API_PORT', () => {
    expect(resolveApiProxyTarget({ API_PORT: '3100' }, {})).toBe('http://localhost:3100');
    expect(resolveApiProxyTarget({}, {})).toBe('http://localhost:3000');
  });

  it('allows an explicit remote proxy target', () => {
    expect(resolveApiProxyTarget({ VITE_API_PROXY_TARGET: 'https://api.example.test' }, { API_PORT: '3100' }))
      .toBe('https://api.example.test');
  });

  it('rejects a local web/API port collision', () => {
    expect(() => resolveApiProxyTarget({ API_PORT: '5173' }, {}, 5173)).toThrow('WEB_PORT');
    expect(() => resolveApiProxyTarget({ VITE_API_PROXY_TARGET: 'http://0.0.0.0:5173' }, {}, 5173)).toThrow('WEB_PORT');
  });

  it('rejects identical WEB_PORT and API_PORT even with a remote proxy override', () => {
    const rootEnv = { API_PORT: '5173', VITE_API_PROXY_TARGET: 'https://api.example.test' };
    const webEnv = { WEB_PORT: '5173' };
    expect(() => resolveApiProxyTarget(rootEnv, {}, resolveWebPort(webEnv))).toThrow('WEB_PORT');
  });

  it('uses app-local API_PORT when root configuration does not define it', () => {
    expect(() => resolveApiProxyTarget({}, {
      API_PORT: '5173',
      VITE_API_PROXY_TARGET: 'https://api.example.test',
    }, 5173)).toThrow('WEB_PORT');
  });
});
