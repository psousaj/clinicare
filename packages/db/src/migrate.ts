import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDatabase, getDatabase, getDatabasePool } from './index'
import { quoteIdentifier } from './database-config';

export async function migrateDatabase() {
  const migrationsFolder = process.env.MIGRATIONS_FOLDER ?? new URL('../drizzle', import.meta.url).pathname;
  const applicationSchema = await resolveApplicationSchema(getDatabasePool());
  const migrationsSchema = applicationSchema;
  await getDatabasePool().query(`SET search_path TO ${quoteIdentifier(applicationSchema)}`);
  await ensurePgTrgmExtension()
  await migrate(getDatabase(), { migrationsFolder, migrationsSchema });
}

export async function resolveApplicationSchema(pool: Pick<ReturnType<typeof getDatabasePool>, 'query'>): Promise<string> {
  const result = await pool.query<{ schema_name: string; has_ledger: boolean; has_application_tables: boolean }>(`
    SELECT n.nspname AS schema_name,
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace cn ON cn.oid = c.relnamespace
        WHERE cn.nspname = n.nspname AND c.relname = '__drizzle_migrations' AND c.relkind = 'r'
      ) AS has_ledger,
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace cn ON cn.oid = c.relnamespace
        WHERE cn.nspname = n.nspname AND c.relkind IN ('r', 'p')
          AND c.relname IN ('tenants', 'user', 'patients')
      ) AND (
        SELECT count(DISTINCT c.relname) = 3
        FROM pg_class c JOIN pg_namespace cn ON cn.oid = c.relnamespace
        WHERE cn.nspname = n.nspname AND c.relkind IN ('r', 'p')
          AND c.relname IN ('tenants', 'user', 'patients')
      ) AS has_application_tables
    FROM pg_namespace n
    WHERE n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
      AND n.nspname <> 'information_schema'
      AND (
        EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace cn ON cn.oid = c.relnamespace
          WHERE cn.nspname = n.nspname AND c.relname = '__drizzle_migrations' AND c.relkind = 'r'
        )
        OR EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace cn ON cn.oid = c.relnamespace
          WHERE cn.nspname = n.nspname AND c.relkind IN ('r', 'p')
            AND c.relname IN ('tenants', 'user', 'patients')
        )
      )
    ORDER BY n.nspname
  `);
  const candidates = result.rows.filter((row) => row.has_ledger || row.has_application_tables);
  const occupiedResult = await pool.query<{ schema_name: string; object_count: number }>(`
    SELECT n.nspname AS schema_name, count(c.oid)::int AS object_count
    FROM pg_namespace n
    LEFT JOIN pg_class c ON c.relnamespace = n.oid
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    WHERE n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
      AND n.nspname <> 'information_schema'
    GROUP BY n.nspname
    HAVING count(c.oid) > 0
    ORDER BY n.nspname
  `);
  const unexpectedSchemas = occupiedResult.rows
    .filter(({ schema_name }) => schema_name !== 'public' && schema_name !== 'clinicare');
  if (unexpectedSchemas.length) {
    throw new Error(`Unrecognized occupied PostgreSQL schema(s): ${unexpectedSchemas.map(({ schema_name }) => schema_name).join(', ')}. Explicit namespace migration is required before startup.`);
  }
  const publicMarkers = await pool.query<{ relname: string }>(`
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND c.relname IN ('__drizzle_migrations', 'tenants', 'user', 'patients')
  `);
  if (publicMarkers.rows.length) {
    throw new Error('A legacy Clinicare installation or ledger exists in public; refusing implicit migration.');
  }
  if (candidates.length > 1) {
    throw new Error(`Ambiguous Clinicare PostgreSQL installation across schemas: ${candidates.map(({ schema_name }) => schema_name).join(', ')}.`);
  }
  if (candidates.length === 1) {
    const [candidate] = candidates;
    if (!candidate!.has_ledger || !candidate!.has_application_tables) {
      throw new Error(`Incomplete Clinicare PostgreSQL installation in schema "${candidate!.schema_name}"; refusing to initialize or select another schema.`);
    }
    if (candidate!.schema_name !== 'clinicare') {
      throw new Error(`Clinicare installation is in non-canonical schema "${candidate!.schema_name}"; run the explicit namespace migration before startup.`);
    }
    return candidate!.schema_name;
  }

  const empty = await pool.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'clinicare' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    ) AS exists
  `);
  if (empty.rows[0]?.exists) {
    throw new Error('The canonical clinicare schema contains objects but no recognizable Clinicare installation; refusing to initialize it.');
  }
  await pool.query('CREATE SCHEMA IF NOT EXISTS clinicare');
  return 'clinicare';
}

export async function migrateLegacySchema(
  pool: Pick<ReturnType<typeof getDatabasePool>, 'query' | 'connect'>,
  sourceSchema: string,
): Promise<void> {
  if (!/^[a-z_][a-z0-9_$]{0,62}$/i.test(sourceSchema) || sourceSchema === 'clinicare' || sourceSchema === 'public') {
    throw new Error('Legacy schema must be an explicitly named non-canonical PostgreSQL identifier.');
  }
  const quotedSource = quoteIdentifier(sourceSchema);
  const result = await pool.query<{ has_ledger: boolean; has_core_tables: boolean; canonical_exists: boolean; canonical_occupied: boolean; canonical_installation: boolean; already_migrated_from: boolean }>(`
    SELECT
      to_regclass(format('%I.__drizzle_migrations', $1::text)) IS NOT NULL AS has_ledger,
      (
        to_regclass(format('%I.tenants', $1::text)) IS NOT NULL
        AND to_regclass(format('%I.user', $1::text)) IS NOT NULL
        AND to_regclass(format('%I.patients', $1::text)) IS NOT NULL
      ) AS has_core_tables,
      EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'clinicare') AS canonical_exists,
      obj_description((SELECT oid FROM pg_namespace WHERE nspname = 'clinicare'), 'pg_namespace') = $2::text AS already_migrated_from,
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'clinicare' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      ) AS canonical_occupied,
      (
        to_regclass('clinicare.__drizzle_migrations') IS NOT NULL
        AND to_regclass('clinicare.tenants') IS NOT NULL
        AND to_regclass('clinicare.user') IS NOT NULL
        AND to_regclass('clinicare.patients') IS NOT NULL
      ) AS canonical_installation
  `, [sourceSchema, `clinicare-migrated-from:${sourceSchema}`]);
  const state = result.rows[0]!;
  if (!state.canonical_exists && !await schemaExists(pool, sourceSchema)) {
    throw new Error(`Neither legacy schema "${sourceSchema}" nor canonical Clinicare schema exists.`);
  }
  if (state.already_migrated_from) {
    if (state.canonical_installation && !await schemaExists(pool, sourceSchema)) return;
    throw new Error(`Schema migration marker for "${sourceSchema}" does not match a complete canonical installation.`);
  }
  if (!state.has_ledger || !state.has_core_tables) {
    throw new Error(`Legacy schema "${sourceSchema}" does not contain the Clinicare core tables and Drizzle ledger.`);
  }
  if (state.canonical_occupied) {
    throw new Error('Canonical schema clinicare already contains objects; refusing namespace collision.');
  }
  const publicInstallation = await pool.query<{ has_markers: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
        AND c.relname IN ('__drizzle_migrations', 'tenants', 'user', 'patients')
    ) AS has_markers
  `);
  if (publicInstallation.rows[0]?.has_markers) {
    throw new Error('A Clinicare ledger or core table exists in public; refusing namespace migration until the installation is inventoried.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`ALTER SCHEMA ${quotedSource} RENAME TO clinicare`);
    await client.query(`COMMENT ON SCHEMA clinicare IS '${`clinicare-migrated-from:${sourceSchema}`}'`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function schemaExists(pool: Pick<ReturnType<typeof getDatabasePool>, 'query'>, schema: string) {
  const result = await pool.query<{ exists: boolean }>('SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS exists', [schema]);
  return result.rows[0]?.exists ?? false;
}

async function ensurePgTrgmExtension() {
  const pool = getDatabasePool()
  const result = await pool.query<{ schema_name: string; owner_name: string }>(`select n.nspname as schema_name, r.rolname as owner_name from pg_extension e join pg_namespace n on n.oid = e.extnamespace join pg_roles r on r.oid = e.extowner where e.extname = 'pg_trgm'`)
  const currentSchema = result.rows[0]?.schema_name
  if (!currentSchema) {
    await pool.query('create extension if not exists pg_trgm schema public')
  } else if (currentSchema !== 'public') {
    if (result.rows[0]?.owner_name !== (await pool.query<{ current_user: string }>('select current_user')).rows[0]?.current_user) {
      throw new Error('pg_trgm is installed outside public and is not owned by the migration user; move it to public explicitly before migrating.')
    }
    await pool.query(`alter extension pg_trgm set schema public`)
  }
}

if (import.meta.main) {
  try {
    await migrateDatabase();
    console.log('PostgreSQL migrations applied.');
  } finally {
    await closeDatabase();
  }
}
