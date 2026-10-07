import { describe, expect, it } from 'bun:test';
import { resolveStorageConfig } from './storage-config';

describe('R2 endpoint configuration', () => {
  it('accepts the bucket URL shown by Cloudflare and separates endpoint from bucket', () => {
    expect(resolveStorageConfig({ R2_ENDPOINT_URL: 'https://8a1dfd89d3afdcf974dc71a68dffd2b5.r2.cloudflarestorage.com/clinicare' })).toEqual({
      endpoint: 'https://8a1dfd89d3afdcf974dc71a68dffd2b5.r2.cloudflarestorage.com',
      bucket: 'clinicare',
      region: 'auto',
      forcePathStyle: false,
      provider: 'r2',
    });
  });

  it('rejects a bucket that conflicts with the endpoint path', () => {
    expect(() => resolveStorageConfig({ R2_ENDPOINT_URL: 'https://account.r2.cloudflarestorage.com/clinicare', R2_BUCKET: 'other' })).toThrow('R2_BUCKET deve corresponder');
  });

  it('uses explicit MiniStack settings for local development, separate from Cloudflare credentials', () => {
    expect(resolveStorageConfig({
      MINISTACK_ENDPOINT: 'http://localhost:4566', MINISTACK_BUCKET: 'clinicare-dev',
      CLOUDFLARE_ACCOUNT_ID: 'account', R2_BUCKET: 'clinicare',
    })).toEqual({
      endpoint: 'http://localhost:4566', bucket: 'clinicare-dev', region: 'us-east-1', forcePathStyle: true, provider: 'ministack',
    });
  });

  it('derives the standard R2 endpoint from the account ID when MiniStack is absent', () => {
    expect(resolveStorageConfig({ CLOUDFLARE_ACCOUNT_ID: 'account', R2_BUCKET: 'clinicare' }).endpoint).toBe('https://account.r2.cloudflarestorage.com');
  });
});
