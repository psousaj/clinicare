import { describe, expect, test } from 'bun:test'
import {
  getDatabaseSchema,
  getMigrationsSchema,
  getSearchPathOption,
  getSchemaFilter,
} from './database-config'

describe('database schema configuration', () => {
  test('requires a configured schema', () => {
    delete process.env.DB_SCHEMA
    expect(() => getDatabaseSchema()).toThrow('DB_SCHEMA is required')
  })

  test('isolates the migration ledger and application search path', () => {
    process.env.DB_SCHEMA = 'clinicare_dev'
    expect(getDatabaseSchema()).toBe('clinicare_dev')
    expect(getMigrationsSchema()).toBe('clinicare_dev')
    expect(getSearchPathOption()).toBe('-c search_path="clinicare_dev"')
    expect(getSchemaFilter()).toEqual(['clinicare_dev'])
    delete process.env.DB_SCHEMA
  })

  test('rejects unsafe or overlong identifiers', () => {
    process.env.DB_SCHEMA = 'clinic; DROP SCHEMA public'
    expect(() => getDatabaseSchema()).toThrow('valid PostgreSQL identifier')
    process.env.DB_SCHEMA = 'a'.repeat(64)
    expect(() => getDatabaseSchema()).toThrow('63 bytes')
    delete process.env.DB_SCHEMA
  })
})
