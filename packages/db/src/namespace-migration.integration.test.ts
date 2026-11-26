import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Pool } from 'pg';
import { migrateLegacySchema, resolveApplicationSchema } from './migrate';

const databaseUrl = process.env.NAMESPACE_TEST_DATABASE_URL;
const namespaceIntegration = databaseUrl ? describe : describe.skip;

function assertDisposableNamespaceDatabase() {
  if (!databaseUrl) throw new Error('NAMESPACE_TEST_DATABASE_URL is required.');
  const url = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(url.hostname)
      || !/^clinicare_namespace_test_[a-z0-9_]+$/i.test(url.pathname.slice(1))) {
    throw new Error('Namespace migration tests require a local disposable database named clinicare_namespace_test_<suffix>.');
  }
}

namespaceIntegration('explicit PostgreSQL namespace migration', () => {
  const pool = new Pool({ connectionString: databaseUrl });
  let safeToCleanUp = false;

  beforeAll(async () => {
    assertDisposableNamespaceDatabase();
    const occupied = await pool.query<{ schema_name: string; object_count: number }>(`
      SELECT n.nspname AS schema_name, count(c.oid)::int AS object_count
      FROM pg_namespace n LEFT JOIN pg_class c ON c.relnamespace = n.oid
      WHERE n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
        AND n.nspname <> 'information_schema'
      GROUP BY n.nspname HAVING count(c.oid) > 0
    `);
    if (occupied.rows.length) {
      throw new Error('Namespace migration tests require an empty disposable database.');
    }
    safeToCleanUp = true;
  });

  afterAll(async () => {
    if (safeToCleanUp) {
      await pool.query('DROP SCHEMA IF EXISTS clinicare CASCADE');
      await pool.query('DROP SCHEMA IF EXISTS legacy_clinic CASCADE');
      await pool.query('DROP SCHEMA IF EXISTS unrelated_collision CASCADE');
    }
    await pool.end();
  });

  it('creates canonical namespace, migrates a legacy ledger atomically, retries, and rejects collisions', async () => {
    expect(await resolveApplicationSchema(pool)).toBe('clinicare');
    await pool.query('DROP SCHEMA clinicare CASCADE');
    await pool.query('CREATE TABLE public.__drizzle_migrations (id integer)');
    await expect(resolveApplicationSchema(pool)).rejects.toThrow('legacy Clinicare installation or ledger exists in public');
    await pool.query('DROP TABLE public.__drizzle_migrations');
    await pool.query('CREATE SCHEMA legacy_clinic');
    await pool.query('CREATE TABLE legacy_clinic.tenants (id uuid PRIMARY KEY)');
    await pool.query('CREATE TABLE legacy_clinic."user" (id text PRIMARY KEY)');
    await pool.query('CREATE TABLE legacy_clinic.patients (id uuid PRIMARY KEY, tenant_id uuid REFERENCES legacy_clinic.tenants(id))');
    await pool.query('CREATE TABLE legacy_clinic.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint NOT NULL)');
    await pool.query('CREATE SEQUENCE legacy_clinic.preserved_sequence');
    await pool.query('CREATE TABLE legacy_clinic.sequence_owner (id bigint DEFAULT nextval(\'legacy_clinic.preserved_sequence\'))');
    await pool.query('CREATE TABLE public.tenants (id uuid PRIMARY KEY)');
    await expect(migrateLegacySchema(pool, 'legacy_clinic')).rejects.toThrow('exists in public');
    await pool.query('DROP TABLE public.tenants');
    await pool.query("INSERT INTO legacy_clinic.tenants VALUES ('00000000-0000-0000-0000-000000000001')");
    await pool.query("INSERT INTO legacy_clinic.patients VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001')");
    await pool.query("INSERT INTO legacy_clinic.__drizzle_migrations (hash, created_at) VALUES ('fixture-ledger-entry', 1)");
    await pool.query('INSERT INTO legacy_clinic.sequence_owner DEFAULT VALUES');
    await pool.query('GRANT SELECT ON legacy_clinic.tenants TO PUBLIC');

    await migrateLegacySchema(pool, 'legacy_clinic');
    await migrateLegacySchema(pool, 'legacy_clinic');
    expect(await resolveApplicationSchema(pool)).toBe('clinicare');

    const preserved = await pool.query<{ tenant_count: number; patient_count: number; ledger_count: number; sequence_value: string; fk_count: number; tenants_acl: string[] }>(`
      SELECT
        (SELECT count(*)::int FROM clinicare.tenants) AS tenant_count,
        (SELECT count(*)::int FROM clinicare.patients) AS patient_count,
        (SELECT count(*)::int FROM clinicare.__drizzle_migrations) AS ledger_count,
        (SELECT last_value::text FROM clinicare.preserved_sequence) AS sequence_value,
        (SELECT count(*)::int FROM pg_constraint
          WHERE conrelid = 'clinicare.patients'::regclass AND contype = 'f') AS fk_count,
        (SELECT relacl FROM pg_class WHERE oid = 'clinicare.tenants'::regclass) AS tenants_acl
    `);
    expect(preserved.rows[0]).toMatchObject({
      tenant_count: 1,
      patient_count: 1,
      ledger_count: 1,
      sequence_value: '1',
      fk_count: 1,
    });
    expect(preserved.rows[0]?.tenants_acl).toContain('=r/');

    await pool.query('CREATE SCHEMA unrelated_collision');
    await pool.query('CREATE TABLE unrelated_collision.tenants (id uuid PRIMARY KEY)');
    await expect(resolveApplicationSchema(pool)).rejects.toThrow('Unrecognized occupied PostgreSQL schema');
  });
});
