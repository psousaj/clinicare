import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdempotencyKey } from './idempotency';

describe('createIdempotencyKey', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses randomUUID when the browser exposes it', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-from-browser' });

    expect(createIdempotencyKey()).toBe('uuid-from-browser');
  });

  it('generates a UUID-shaped key with getRandomValues when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) });

    expect(createIdempotencyKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('keeps the flow usable when Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);

    expect(createIdempotencyKey()).toMatch(/^idempotency-/);
  });
});
