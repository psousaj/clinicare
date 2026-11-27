import { describe, expect, it } from 'bun:test';
import { resolveStorageConfig } from './storage-config';

describe('R2 endpoint configuration', () => {
  it('derives the R2 endpoint from the account ID and uses the configured bucket', () => {
    expect(resolveStorageConfig({
      CLOUDFLARE_ACCOUNT_ID: '8a1dfd89d3afdcf974dc71a68dffd2b5',
      R2_BUCKET: 'clinicare',
      R2_ACCESS_KEY_ID: 'test-access-key',
      R2_SECRET_ACCESS_KEY: 'test-secret-key',
    })).toEqual({
      endpoint: 'https://8a1dfd89d3afdcf974dc71a68dffd2b5.r2.cloudflarestorage.com',
      bucket: 'clinicare',
      region: 'auto',
      forcePathStyle: false,
      provider: 'r2',
    });
  });

  it('rejects the removed endpoint override', () => {
    expect(() => resolveStorageConfig({ R2_ENDPOINT_URL: 'https://account.r2.cloudflarestorage.com/bucket' })).toThrow('R2_ENDPOINT_URL foi removida');
  });

  it('requires a valid account ID and bucket when R2 is partially configured', () => {
    expect(() => resolveStorageConfig({ R2_BUCKET: 'clinicare' })).toThrow('CLOUDFLARE_ACCOUNT_ID');
    expect(() => resolveStorageConfig({ CLOUDFLARE_ACCOUNT_ID: 'account' })).toThrow('CLOUDFLARE_ACCOUNT_ID');
    expect(() => resolveStorageConfig({ CLOUDFLARE_ACCOUNT_ID: '8a1dfd89d3afdcf974dc71a68dffd2b5' })).toThrow('R2_BUCKET');
  });

  it('requires S3 credentials and excludes MiniStack in production', () => {
    const productionConfig = {
      NODE_ENV: 'production',
      CLOUDFLARE_ACCOUNT_ID: '8a1dfd89d3afdcf974dc71a68dffd2b5',
      R2_BUCKET: 'clinicare',
    };
    expect(() => resolveStorageConfig(productionConfig)).toThrow('R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY');
    expect(() => resolveStorageConfig({
      CLOUDFLARE_ACCOUNT_ID: '8a1dfd89d3afdcf974dc71a68dffd2b5',
      R2_BUCKET: 'clinicare',
      R2_ACCESS_KEY_ID: 'key-only',
    })).toThrow('devem ser configuradas juntas');
    expect(() => resolveStorageConfig({
      NODE_ENV: 'development',
      MINISTACK_ENDPOINT: 'http://localhost:4566',
      MINISTACK_BUCKET: 'local',
      MINISTACK_ACCESS_KEY_ID: 'local-key',
    })).toThrow('MINISTACK_ACCESS_KEY_ID e MINISTACK_SECRET_ACCESS_KEY');
    expect(() => resolveStorageConfig({ ...productionConfig, MINISTACK_ENDPOINT: 'http://localhost:4566', MINISTACK_BUCKET: 'local' }))
      .toThrow('MINISTACK_ENDPOINT não pode ser usado em produção');
  });

  it('uses explicit MiniStack settings for local development, separate from Cloudflare credentials', () => {
    expect(resolveStorageConfig({
      MINISTACK_ENDPOINT: 'http://localhost:4566', MINISTACK_BUCKET: 'clinicare-dev',
      MINISTACK_ACCESS_KEY_ID: 'local-key', MINISTACK_SECRET_ACCESS_KEY: 'local-secret',
      NODE_ENV: 'development',
      CLOUDFLARE_ACCOUNT_ID: '8a1dfd89d3afdcf974dc71a68dffd2b5', R2_BUCKET: 'clinicare',
    })).toEqual({
      endpoint: 'http://localhost:4566', bucket: 'clinicare-dev', region: 'us-east-1', forcePathStyle: true, provider: 'ministack',
    });
  });

  it('uses R2 rather than MiniStack when the emulator endpoint is explicitly empty', () => {
    expect(resolveStorageConfig({
      NODE_ENV: 'test',
      MINISTACK_ENDPOINT: '',
      MINISTACK_BUCKET: 'clinicare-dev',
      MINISTACK_ACCESS_KEY_ID: 'local-key',
      MINISTACK_SECRET_ACCESS_KEY: 'local-secret',
      CLOUDFLARE_ACCOUNT_ID: '8a1dfd89d3afdcf974dc71a68dffd2b5',
      R2_ACCESS_KEY_ID: 'test-access-key',
      R2_SECRET_ACCESS_KEY: 'test-secret-key',
      R2_BUCKET: 'clinicare-test',
    })).toMatchObject({
      endpoint: 'https://8a1dfd89d3afdcf974dc71a68dffd2b5.r2.cloudflarestorage.com',
      bucket: 'clinicare-test',
      provider: 'r2',
    });
  });

  it('derives the standard R2 endpoint from the account ID when MiniStack is absent', () => {
    expect(resolveStorageConfig({
      CLOUDFLARE_ACCOUNT_ID: '8a1dfd89d3afdcf974dc71a68dffd2b5',
      R2_BUCKET: 'clinicare',
      R2_ACCESS_KEY_ID: 'test-access-key',
      R2_SECRET_ACCESS_KEY: 'test-secret-key',
    }).endpoint)
      .toBe('https://8a1dfd89d3afdcf974dc71a68dffd2b5.r2.cloudflarestorage.com');
  });
});
