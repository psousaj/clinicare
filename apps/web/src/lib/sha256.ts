import { sha256 } from '@noble/hashes/sha2.js';

export async function sha256Hex(file: Pick<Blob, 'arrayBuffer'>): Promise<string> {
  const digest = sha256(new Uint8Array(await file.arrayBuffer()));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
