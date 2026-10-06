import { randomBytes } from 'node:crypto';

const secretNames = [
  'DATA_ENCRYPTION_KEY',
  'SEARCH_HMAC_KEY',
  'UPLOAD_SIGNING_KEY',
  'BETTER_AUTH_SECRET',
  'BOOTSTRAP_ADMIN_PASSWORD',
] as const;

for (const name of secretNames) {
  console.log(`${name}=${randomBytes(32).toString('base64')}`);
}
