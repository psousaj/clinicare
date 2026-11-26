import { describe, expect, it } from 'bun:test';
import { resolveApiPort } from './runtime-config';

describe('resolveApiPort', () => {
  it('uses the default port when API_PORT is unset', () => {
    expect(resolveApiPort(undefined)).toBe(3000);
  });

  it('accepts an integer port in range', () => {
    expect(resolveApiPort('8080')).toBe(8080);
    expect(resolveApiPort('1')).toBe(1);
    expect(resolveApiPort('65535')).toBe(65535);
  });

  it('rejects non-integer, non-numeric, and out-of-range values', () => {
    for (const value of ['', ' 3000', '3000 ', '3.5', '0', '65536', 'abc']) {
      expect(() => resolveApiPort(value)).toThrow('API_PORT');
    }
  });
});
