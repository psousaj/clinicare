import { afterAll, describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';

const enabled = process.env.MINISTACK_INTEGRATION_TESTS === '1';
const objectKeys: string[] = [];
const testBucket = process.env.MINISTACK_TEST_BUCKET?.trim();
let storageApi: typeof import('./storage') | undefined;

describe('MiniStack S3-compatible integration', () => {
  it.skipIf(!enabled)('uploads and downloads bytes through the storage client and signed URLs with matching hashes', async () => {
    if (process.env.NODE_ENV === 'production') throw new Error('O teste MiniStack não pode executar em produção.');
    if (!testBucket) throw new Error('Configure MINISTACK_TEST_BUCKET para o teste isolado.');
    if (testBucket === process.env.MINISTACK_BUCKET?.trim()) {
      throw new Error('MINISTACK_TEST_BUCKET deve ser diferente do bucket de desenvolvimento.');
    }
    if (testBucket === process.env.R2_BUCKET?.trim()) {
      throw new Error('MINISTACK_TEST_BUCKET deve ser diferente do bucket Cloudflare R2.');
    }
    const endpoint = process.env.MINISTACK_ENDPOINT?.trim();
    if (!endpoint || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname)) {
      throw new Error('O teste MiniStack só pode usar um endpoint local.');
    }
    process.env.MINISTACK_BUCKET = testBucket;
    storageApi = await import('./storage');
    if (!storageApi.storage || storageApi.bucket !== testBucket) {
      throw new Error('Configure o MiniStack e inicialize MINISTACK_TEST_BUCKET antes do teste.');
    }

    const key = `integration-tests/${crypto.randomUUID()}.bin`;
    objectKeys.push(key);
    const payload = new TextEncoder().encode(`clinicare-ministack-integration:${crypto.randomUUID()}`);
    const expectedHash = createHash('sha256').update(payload).digest('hex');

    try {
      await storageApi.uploadObjectBytes(key, payload, 'application/octet-stream');
      const downloaded = await storageApi.downloadObjectBytes(key);
      expect(createHash('sha256').update(downloaded).digest('hex')).toBe(expectedHash);

      const signedPayload = new TextEncoder().encode(`clinicare-ministack-signed-upload:${crypto.randomUUID()}`);
      const signedHash = createHash('sha256').update(signedPayload).digest('hex');
      const putUrl = await storageApi.uploadUrl(key, 'application/octet-stream');
      expect(new URL(putUrl).searchParams.has('X-Amz-Signature')).toBe(true);
      const uploadResponse = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: signedPayload,
      });
      expect(uploadResponse.ok).toBe(true);
      const afterSignedUpload = await storageApi.downloadObjectBytes(key);
      expect(createHash('sha256').update(afterSignedUpload).digest('hex')).toBe(signedHash);

      const getUrl = await storageApi.downloadUrl(key);
      expect(getUrl).not.toBeNull();
      expect(new URL(getUrl!).searchParams.has('X-Amz-Signature')).toBe(true);
      const downloadResponse = await fetch(getUrl!);
      expect(downloadResponse.ok).toBe(true);
      const signedDownload = new Uint8Array(await downloadResponse.arrayBuffer());
      expect(createHash('sha256').update(signedDownload).digest('hex')).toBe(signedHash);
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
