import { describe, expect, it } from 'bun:test';
import { seedDatabase } from '@clinicare/db';

describe('development tenant seed', () => {
  it('refuses to create the fictitious tenant in production', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(seedDatabase()).rejects.toThrow('only in development and test');
    } finally {
      if (original === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = original;
    }
  });
  it('refuses fictitious seeds when the runtime environment is unspecified', async () => {
    const original = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      await expect(seedDatabase()).rejects.toThrow('only in development and test');
    } finally {
      if (original !== undefined) process.env.NODE_ENV = original;
    }
  });
});
