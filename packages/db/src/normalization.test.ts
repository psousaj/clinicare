import { describe, expect, it } from 'bun:test';
import { normalizeCpf, normalizeEmail, normalizePhone } from './normalization';

describe('patient search normalization', () => {
  it('normalizes email and phone without guessing country codes', () => {
    expect(normalizeEmail('  ANA@Example.COM ')).toBe('ana@example.com');
    expect(normalizePhone('+55 (11) 99999-0000')).toBe('5511999990000');
    expect(normalizePhone('   ')).toBeNull();
  });
  it('requires exactly eleven CPF digits', () => {
    expect(normalizeCpf('123.456.789-01')).toBe('12345678901');
    expect(() => normalizeCpf('123')).toThrow();
  });
});
