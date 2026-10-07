import { describe, expect, it } from 'bun:test';
import { bootstrapConfigFromEnv } from './admin-commands';

describe('initial administrator bootstrap configuration', () => {
  it('is optional in any environment when no bootstrap values are configured', () => {
    expect(bootstrapConfigFromEnv({ NODE_ENV: 'development' })).toBeNull();
    expect(bootstrapConfigFromEnv({ NODE_ENV: 'production' })).toBeNull();
  });

  it('requires the full bootstrap configuration when any value is provided', () => {
    expect(() => bootstrapConfigFromEnv({ BOOTSTRAP_ADMIN_EMAIL: 'admin@example.com' })).toThrow('Configure todas as variáveis BOOTSTRAP_*');
  });

  it('uses the configured clinic administrator values without a default password', () => {
    expect(bootstrapConfigFromEnv({
      BOOTSTRAP_CLINIC_NAME: ' Clínica Exemplo ',
      BOOTSTRAP_ADMIN_NAME: ' Ana Exemplo ',
      BOOTSTRAP_ADMIN_EMAIL: ' ANA@example.com ',
      BOOTSTRAP_ADMIN_PASSWORD: 'senha-forte-123',
    })).toMatchObject({
      clinicName: 'Clínica Exemplo',
      administratorName: 'Ana Exemplo',
      email: 'ANA@example.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
    });
  });
});
