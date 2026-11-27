import { describe, expect, it } from 'bun:test';
import { parsePort } from './index';

describe('parsePort', () => {
  it('uses the provided fallback when unset', () => {
    expect(parsePort(undefined, 'API_PORT', 3000)).toBe(3000);
  });

  it('accepts integer TCP ports in range', () => {
    expect(parsePort('1', 'API_PORT', 3000)).toBe(1);
    expect(parsePort('65535', 'WEB_PORT', 5173)).toBe(65535);
  });

  it('rejects malformed and out-of-range ports', () => {
    for (const value of ['', ' 3000', '3000 ', '3.5', '0', '65536', 'abc']) {
      expect(() => parsePort(value, 'API_PORT', 3000)).toThrow('API_PORT');
    }
  });
});
