import { beforeEach, describe, expect, it } from 'bun:test';
import { buildPatientAad, decryptValue, encryptValue, searchHmac } from './crypto';

describe('patient crypto', () => {
  beforeEach(() => {
    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
    process.env.SEARCH_HMAC_KEY = Buffer.alloc(32, 2).toString('base64');
  });
  it('round trips with a fresh nonce and authenticated AAD', () => {
    const aad = buildPatientAad('tenant', 'record', 'email');
    const first = encryptValue('a@example.com', aad);
    const second = encryptValue('a@example.com', aad);
    expect(first.nonce).not.toBe(second.nonce);
    expect(decryptValue(first, aad)).toBe('a@example.com');
    expect(() => decryptValue(first, buildPatientAad('other', 'record', 'email'))).toThrow();
  });
  it('rejects tampered ciphertext and a ciphertext encrypted with another key', () => {
    const aad = buildPatientAad('tenant', 'record', 'email');
    const encrypted = encryptValue('secret', aad);
    const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA` };
    expect(() => decryptValue(tampered, aad)).toThrow();

    process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    expect(() => decryptValue(encrypted, aad)).toThrow();
  });

  it('fails clearly when keys are missing', () => {
    delete process.env.DATA_ENCRYPTION_KEY;
    expect(() => encryptValue('secret', Buffer.from('aad'))).toThrow('DATA_ENCRYPTION_KEY is required');
  });
  it('creates contextual search hashes', () => {
    expect(searchHmac('tenant', 'email', 'a@example.com')).toBe(searchHmac('tenant', 'email', 'a@example.com'));
    expect(searchHmac('tenant', 'email', 'a@example.com')).not.toBe(searchHmac('other', 'email', 'a@example.com'));
  });
});
