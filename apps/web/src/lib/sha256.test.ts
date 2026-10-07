import { describe, expect, it } from 'vitest';
import { sha256Hex } from './sha256';

describe('sha256Hex', () => {
  it('hashes file bytes without requiring Web Crypto secure-context support', async () => {
    const file = new File(['abc'], 'sample.docx');
    await expect(sha256Hex(file)).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
