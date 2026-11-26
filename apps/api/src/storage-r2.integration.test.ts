import { afterAll, describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';

const enabled = process.env.R2_INTEGRATION_TESTS === '1';
const testBucket = process.env.R2_TEST_BUCKET?.trim();
const objectKeys: string[] = [];
let storageApi: typeof import('./storage') | undefined;

describe('real Cloudflare R2 integration', () => {
  it.skipIf(!enabled)('uploads and downloads a private object through server-signed URLs and verifies its digest', async () => {
    if (process.env.NODE_ENV === 'production') throw new Error('O teste de integração R2 não pode executar em produção.');
    storageApi = await import('./storage');
    if (!storageApi.storage || !storageApi.bucket) throw new Error('Configure as credenciais S3 do R2 antes do teste.');
    if (!testBucket || testBucket !== storageApi.bucket) {
      throw new Error('Defina R2_TEST_BUCKET igual a R2_BUCKET, apontando para um bucket isolado de teste.');
    }

    const key = `integration-tests/${crypto.randomUUID()}.bin`;
    objectKeys.push(key);
    const payload = new TextEncoder().encode(`clinicare-r2-integration:${crypto.randomUUID()}`);
    const expectedHash = createHash('sha256').update(payload).digest('hex');

    try {
      const putUrl = await storageApi.uploadUrl(key, 'application/octet-stream');
      expect(new URL(putUrl).searchParams.has('X-Amz-Signature')).toBe(true);
      const uploadResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: payload,
      });
      expect(uploadResponse.ok).toBe(true);

      const getUrl = await storageApi.downloadUrl(key);
      expect(getUrl).not.toBeNull();
      expect(new URL(getUrl!).searchParams.has('X-Amz-Signature')).toBe(true);
      const downloadResponse = await fetch(getUrl!);
      expect(downloadResponse.ok).toBe(true);
      const downloaded = new Uint8Array(await downloadResponse.arrayBuffer());
      expect(createHash('sha256').update(downloaded).digest('hex')).toBe(expectedHash);
      expect(await storageApi.downloadObjectBytes(key)).toEqual(payload);
    } finally {
      await storageApi.deleteObject(key);
      objectKeys.splice(objectKeys.indexOf(key), 1);
    }
  });
});

afterAll(async () => {
  if (!storageApi?.storage || !storageApi.bucket) return;
  await Promise.all(objectKeys.map((key) => storageApi!.deleteObject(key)));
});
