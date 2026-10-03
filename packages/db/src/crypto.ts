import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ENCRYPTION_KEY_VERSION = 1;
export const SEARCH_HMAC_KEY_VERSION = 1;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

type KeyKind = 'DATA_ENCRYPTION_KEY' | 'SEARCH_HMAC_KEY';

function configuredKey(name: KeyKind, bytes: number): Buffer {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is required to protect patient data.`);
  let key: Buffer;
  key = Buffer.from(raw, 'base64');
  if (!key.length || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw) || raw.replace(/=+$/, '').length % 4 === 1) {
    throw new Error(`${name} must be base64 encoded.`);
  }
  if (key.length !== bytes) throw new Error(`${name} must decode to ${bytes} bytes.`);
  return key;
}

export type EncryptedValue = { ciphertext: string; nonce: string; keyVersion: number };

export function buildPatientAad(tenantId: string, recordId: string, column: string, keyVersion = ENCRYPTION_KEY_VERSION): Buffer {
  return Buffer.from([tenantId, 'patients', recordId, column, String(keyVersion)].join(':'));
}

export function encryptValue(value: string, aad: Buffer, keyVersion = ENCRYPTION_KEY_VERSION): EncryptedValue {
  const key = configuredKey('DATA_ENCRYPTION_KEY', 32);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return { ciphertext: ciphertext.toString('base64'), nonce: nonce.toString('base64'), keyVersion };
}

export function decryptValue(value: EncryptedValue, aad: Buffer): string {
  const key = configuredKey('DATA_ENCRYPTION_KEY', 32);
  const ciphertext = Buffer.from(value.ciphertext, 'base64');
  const nonce = Buffer.from(value.nonce, 'base64');
  if (ciphertext.length < TAG_BYTES || nonce.length !== NONCE_BYTES) throw new Error('Invalid encrypted value.');
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(ciphertext.subarray(-TAG_BYTES));
  return Buffer.concat([decipher.update(ciphertext.subarray(0, -TAG_BYTES)), decipher.final()]).toString('utf8');
}

export function searchHmac(tenantId: string, column: string, normalizedValue: string, normalizationVersion = 1): string {
  const key = configuredKey('SEARCH_HMAC_KEY', 32);
  return createHmac('sha256', key).update([tenantId, 'patients', column, String(normalizationVersion), normalizedValue].join(':')).digest('hex');
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
