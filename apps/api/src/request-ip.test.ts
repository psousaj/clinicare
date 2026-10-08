import { describe, expect, it } from 'bun:test';
import { observedClientIp } from './request-ip';

const request = (headers?: HeadersInit) => new Request('http://localhost/public/signatures/token', { headers });

describe('observedClientIp', () => {
  it('uses the direct server connection when no trusted proxy is configured', () => {
    const ip = observedClientIp(request(), { server: { requestIP: () => ({ address: '203.0.113.10' }) } });
    expect(ip).toBe('203.0.113.10');
  });

  it('uses the first forwarded address only when the proxy peer is explicitly trusted', () => {
    const headers = { 'x-forwarded-for': '198.51.100.7, 203.0.113.10' };
    const server = { server: { requestIP: () => ({ address: '10.0.0.4' }) } };
    expect(observedClientIp(request(headers), server, ['10.0.0.4'])).toBe('198.51.100.7');
    expect(observedClientIp(request(headers), server)).toBe('10.0.0.4');
  });

  it('supports the trusted Cloudflare proxy header', () => {
    const server = { server: { requestIP: () => ({ address: '10.0.0.4' }) } };
    expect(observedClientIp(request({ 'cf-connecting-ip': '198.51.100.8' }), server, ['10.0.0.4'])).toBe('198.51.100.8');
  });

  it('ignores invalid forwarded values and records no invented address', () => {
    expect(observedClientIp(request({ 'x-forwarded-for': 'not-an-ip' }), { server: { requestIP: () => null } }, ['10.0.0.4'])).toBeUndefined();
  });
});
