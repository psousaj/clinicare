import { describe, expect, it } from 'bun:test';
import { observedClientIp } from './request-ip';

const request = (headers?: HeadersInit) => new Request('http://localhost/public/signatures/token', { headers });

describe('observedClientIp', () => {
  it('uses the direct server connection when no trusted proxy is configured', () => {
    const ip = observedClientIp(request(), { server: { requestIP: () => ({ address: '203.0.113.10' }) } });
    expect(ip).toBe('203.0.113.10');
  });

  it('ignores forwarded headers and uses only the direct connection', () => {
    const server = { server: { requestIP: () => ({ address: '10.0.0.4' }) } };
    expect(observedClientIp(request({ 'x-forwarded-for': '198.51.100.7', 'cf-connecting-ip': '198.51.100.8' }), server)).toBe('10.0.0.4');
  });

  it('records no invented address when the runtime does not provide one', () => {
    expect(observedClientIp(request(), { server: { requestIP: () => null } })).toBeUndefined();
    expect(observedClientIp(request(), { server: { requestIP: () => ({ address: 'not-an-ip' }) } })).toBeUndefined();
  });
});
