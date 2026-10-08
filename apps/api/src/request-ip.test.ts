import { describe, expect, it } from 'bun:test';
import { observedClientIp } from './request-ip';

const request = (headers?: HeadersInit) => new Request('http://localhost/public/signatures/token', { headers });

describe('observedClientIp', () => {
  it('prioritizes the Cloudflare source header', () => {
    expect(observedClientIp(request({ 'cf-connecting-ip': '198.51.100.8', 'x-forwarded-for': '198.51.100.7' }))).toBe('198.51.100.8');
  });

  it('supports standard proxy source headers and RFC 7239 Forwarded', () => {
    expect(observedClientIp(request({ 'true-client-ip': '198.51.100.9' }))).toBe('198.51.100.9');
    expect(observedClientIp(request({ 'x-forwarded-for': 'not-an-ip, 203.0.113.10' }))).toBe('203.0.113.10');
    expect(observedClientIp(request({ forwarded: 'for="[2001:db8::1]";proto=https' }))).toBe('2001:db8::1');
  });

  it('returns empty when no valid source header is present', () => {
    expect(observedClientIp(request({ 'x-forwarded-for': 'not-an-ip' }))).toBeUndefined();
  });
});
