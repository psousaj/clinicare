import { describe, expect, it } from 'bun:test';
import { normalizeEvidence } from './signature-evidence';

describe('Signature Evidence Normalization', () => {
  it('normalizes empty or invalid input gracefully', () => {
    const res = normalizeEvidence(null);
    expect(res.collectorVersion).toBe('fingerprintjs-oss-5');
    expect(res.normalizationVersion).toBe('v1');
    expect(res.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(res.unavailableAttributes).toEqual([]);
  });

  it('produces deterministic digests regardless of key insertion order', () => {
    const a = normalizeEvidence({
      version: 'custom-1',
      attributes: { z: 1, a: 2, m: 'test' },
      unavailableAttributes: ['camera', 'geolocation'],
    });

    const b = normalizeEvidence({
      version: 'custom-1',
      attributes: { a: 2, m: 'test', z: 1 },
      unavailableAttributes: ['geolocation', 'camera'],
    });

    expect(a.digest).toBe(b.digest);
    expect(a.collectorVersion).toBe('custom-1');
  });
});
