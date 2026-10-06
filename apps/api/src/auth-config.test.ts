import { describe, expect, it } from 'bun:test';
import { getTrustedOrigins } from './auth-config';

describe('Better Auth trusted origins', () => {
  it('includes the auth base origin and parses comma-separated frontend origins', () => {
    expect(getTrustedOrigins({
      BETTER_AUTH_URL: 'https://app.example.com/api/auth',
      BETTER_AUTH_TRUSTED_ORIGINS: 'http://localhost:5173, http://10.29.28.100:5173,',
    })).toEqual([
      'https://app.example.com',
      'http://localhost:5173',
      'http://10.29.28.100:5173',
    ]);
  });

  it('falls back to the local auth origin when no values are set', () => {
    expect(getTrustedOrigins({})).toEqual(['http://localhost:3000']);
  });
});
