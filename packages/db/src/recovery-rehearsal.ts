import { createHash } from 'node:crypto';
import { existsSync, renameSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { Client } from 'pg';

type DatabaseTarget = {
  url: string;
  host: string;
  port: string;
  database: string;
};

export function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function redactDiagnostics(value: string, sensitiveValues: string[] = []): string {
  let redacted = value;
  for (const secret of sensitiveValues) {
    if (secret) redacted = redacted.replaceAll(secret, '[REDACTED]');
  }
  return redacted
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/\b(password|passwd)\s*=\s*[^,\s]+/gi, '$1=[REDACTED]');
}

export function parseRecoveryTarget(value: string | undefined, label: string): DatabaseTarget {
  if (!value) throw new Error(`${label} is required.`);
  const parsed = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error(`${label} must use PostgreSQL.`);
  }
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname)) {
    throw new Error(`${label} must resolve to loopback; remote targets are refused.`);
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!database || database.includes('/')) throw new Error(`${label} must identify one database.`);
  return { url: value, host: parsed.hostname, port: parsed.port || '5432', database };
}

export function assertRecoveryTargets(source: DatabaseTarget, target: DatabaseTarget): void {
  if (source.database !== 'clinicare') {
    throw new Error('Recovery rehearsal source must be the explicitly named clinicare database.');
  }
  if (source.host !== target.host || source.port !== target.port) {
    throw new Error('Source and restore target must use the same PostgreSQL server.');
  }
  if (source.host === target.host && source.port === target.port && source.database === target.database) {
    throw new Error('Source and restore target must be different databases.');
  }
  if (!target.database.startsWith('clinicare_restore_')) {
    throw new Error('Restore target database name must start with clinicare_restore_.');
  }
}

function run(command: string, args: string[], sensitiveValues: string[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < 64 * 1024) stderr += chunk.toString('utf8').slice(0, 64 * 1024 - stderr.length);
    });
    child.once('error', () => reject(new Error(`${command} could not be started.`)));
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else {
        const safeDiagnostic = redactDiagnostics(stderr, sensitiveValues).trim();
        if (safeDiagnostic) console.error(safeDiagnostic);
        reject(new Error(`${command} failed with exit code ${code ?? 'unknown'}.`));
      }
    });
  });
}

async function assertEmptyTarget(connectionString: string): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT IN ('information_schema')
        AND n.nspname NOT LIKE 'pg_%'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    `);
    if (Number(result.rows[0]?.count ?? 0) !== 0) {
      throw new Error('Restore target is not empty; refusing to overwrite or merge data.');
    }
    const extensions = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM pg_extension WHERE extname <> 'plpgsql'",
    );
    if (Number(extensions.rows[0]?.count ?? 0) !== 0) {
      throw new Error('Restore target already contains extensions; refusing to restore into a non-empty database.');
    }
  } finally {
    await client.end();
  }
}

async function fingerprint(connectionString: string, schema: string) {
  if (!/^[a-z_][a-z0-9_$]{0,62}$/i.test(schema)) {
    throw new Error('RECOVERY_SCHEMA must be a valid PostgreSQL identifier.');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const tableResult = await client.query<{ tablename: string }>(
      'SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename',
      [schema],
    );
    const overall = createHash('sha256');
    let rowCount = 0;
    const tables: Array<{ name: string; rows: number; sha256: string }> = [];
    for (const { tablename } of tableResult.rows) {
      const identifier = `"${schema.replaceAll('"', '""')}"."${tablename.replaceAll('"', '""')}"`;
      const result = await client.query<{ count: string; digest: string }>(
        `SELECT count(*)::text AS count,
          encode(sha256(convert_to(coalesce(string_agg(
            encode(sha256(convert_to(row_to_json(t)::text, 'UTF8')), 'hex'),
            E'\\n' ORDER BY encode(sha256(convert_to(row_to_json(t)::text, 'UTF8')), 'hex')
          ), ''), 'UTF8')), 'hex') AS digest
        FROM ${identifier} t`,
      );
      const tableRowCount = Number(result.rows[0]?.count ?? 0);
      const sha256 = result.rows[0]?.digest ?? '';
      overall.update(tablename);
      overall.update('\0');
      overall.update(String(tableRowCount));
      overall.update('\0');
      overall.update(sha256);
      overall.update('\n');
      tables.push({ name: tablename, rows: tableRowCount, sha256 });
      rowCount += tableRowCount;
    }

    const metadataQueries: Array<{ name: string; query: string; values: unknown[] }> = [
      {
        name: 'extensions',
        query: `SELECT e.extname, e.extversion, n.nspname AS schema
          FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
          ORDER BY e.extname`,
        values: [],
      },
      {
        name: 'constraints',
        query: `SELECT n.nspname, t.relname, c.conname, c.contype, c.convalidated,
            ref_ns.nspname AS referenced_schema, ref_t.relname AS referenced_table,
            pg_get_constraintdef(c.oid) AS definition
          FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          LEFT JOIN pg_class ref_t ON ref_t.oid = c.confrelid
          LEFT JOIN pg_namespace ref_ns ON ref_ns.oid = ref_t.relnamespace
          WHERE n.nspname = $1 OR ref_ns.nspname = $1
          ORDER BY n.nspname, t.relname, c.conname`,
        values: [schema],
      },
      {
        name: 'indexes',
        query: `SELECT tablename, indexname, indexdef FROM pg_indexes
          WHERE schemaname = $1 ORDER BY tablename, indexname`,
        values: [schema],
      },
      {
        name: 'owners-and-acls',
        query: `SELECT c.relname, c.relkind, owner.rolname AS owner, coalesce(c.relacl::text, '') AS acl
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_roles owner ON owner.oid = c.relowner
          WHERE n.nspname = $1 AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
          ORDER BY c.relname, c.relkind`,
        values: [schema],
      },
      {
        name: 'schema-owner-and-acls',
        query: `SELECT n.nspname, owner.rolname AS owner, coalesce(n.nspacl::text, '') AS acl
          FROM pg_namespace n JOIN pg_roles owner ON owner.oid = n.nspowner
          WHERE n.nspname = $1`,
        values: [schema],
      },
      {
        name: 'sequence-definitions',
        query: `SELECT c.relname, s.seqtypid::regtype::text, s.seqstart, s.seqincrement,
            s.seqmax, s.seqmin, s.seqcache, s.seqcycle
          FROM pg_sequence s JOIN pg_class c ON c.oid = s.seqrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 ORDER BY c.relname`,
        values: [schema],
      },
      {
        name: 'table-grants',
        query: `SELECT table_name, grantee, privilege_type, is_grantable
          FROM information_schema.role_table_grants
          WHERE table_schema = $1 ORDER BY table_name, grantee, privilege_type`,
        values: [schema],
      },
      {
        name: 'database-acls',
        query: `SELECT owner.rolname AS owner, coalesce(d.datacl::text, '') AS acl
          FROM pg_database d JOIN pg_roles owner ON owner.oid = d.datdba
          WHERE d.datname = current_database()`,
        values: [],
      },
      {
        name: 'role-memberships',
        query: `SELECT granted.rolname AS granted_role, member.rolname AS member_role,
            grantor.rolname AS grantor_role, m.admin_option
          FROM pg_auth_members m
          JOIN pg_roles granted ON granted.oid = m.roleid
          JOIN pg_roles member ON member.oid = m.member
          JOIN pg_roles grantor ON grantor.oid = m.grantor
          ORDER BY granted.rolname, member.rolname`,
        values: [],
      },
    ];
    for (const item of metadataQueries) {
      const result = await client.query(item.query, item.values);
      const digest = createHash('sha256');
      for (const row of result.rows) {
        digest.update(stableSerialize(row));
        digest.update('\n');
      }
      const componentDigest = digest.digest('hex');
      overall.update(item.name);
      overall.update('\0');
      overall.update(String(result.rowCount ?? 0));
      overall.update('\0');
      overall.update(componentDigest);
      overall.update('\n');
      tables.push({ name: `catalog:${item.name}`, rows: result.rowCount ?? 0, sha256: componentDigest });
    }

    const sequences = await client.query<{ schemaname: string; sequencename: string }>(
      'SELECT schemaname, sequencename FROM pg_sequences WHERE schemaname = $1 ORDER BY sequencename',
      [schema],
    );
    for (const { schemaname, sequencename } of sequences.rows) {
      const identifier = `"${schemaname.replaceAll('"', '""')}"."${sequencename.replaceAll('"', '""')}"`;
      const state = await client.query<{ last_value: string; is_called: boolean }>(
        `SELECT last_value::text, is_called FROM ${identifier}`,
      );
      overall.update('sequence-state\0');
      overall.update(sequencename);
      overall.update('\0');
      overall.update(stableSerialize(state.rows[0] ?? null));
      overall.update('\n');
      tables.push({
        name: `sequence:${sequencename}`,
        rows: 1,
        sha256: createHash('sha256').update(stableSerialize(state.rows[0] ?? null)).digest('hex'),
      });
    }
    return {
      schema,
      tableCount: tableResult.rowCount ?? 0,
      rowCount,
      sha256: overall.digest('hex'),
      tables,
    };
  } finally {
    await client.end();
  }
}

export async function runRecoveryRehearsal(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const source = parseRecoveryTarget(env.RECOVERY_SOURCE_DATABASE_URL, 'RECOVERY_SOURCE_DATABASE_URL');
  const target = parseRecoveryTarget(env.RECOVERY_TARGET_DATABASE_URL, 'RECOVERY_TARGET_DATABASE_URL');
  assertRecoveryTargets(source, target);
  const backupFile = env.RECOVERY_BACKUP_FILE;
  const schema = env.RECOVERY_SCHEMA;
  if (!backupFile || !schema) throw new Error('RECOVERY_BACKUP_FILE and RECOVERY_SCHEMA are required.');
  const migrationSchema = env.RECOVERY_MIGRATIONS_SCHEMA?.trim() || schema;
  if (existsSync(backupFile)) throw new Error('Backup path already exists; choose a new path to preserve prior evidence.');
  const partialBackupFile = `${backupFile}.partial-${process.pid}`;
  if (existsSync(partialBackupFile)) throw new Error('Partial backup path already exists; inspect it before retrying.');

  await assertEmptyTarget(target.url);
  try {
    await run('pg_dump', [
      '--format=custom',
      '--no-owner',
      '--file', partialBackupFile,
      '--dbname', source.url,
    ], [source.url]);
    renameSync(partialBackupFile, backupFile);
  } catch (error) {
    if (existsSync(partialBackupFile)) unlinkSync(partialBackupFile);
    throw error;
  }
  await run('pg_restore', [
    '--exit-on-error',
    '--no-owner',
    '--dbname', target.url,
    backupFile,
  ], [target.url]);

  const schemas = [...new Set([schema, migrationSchema])].sort();
  const [sourceFingerprints, restoredFingerprints] = await Promise.all([
    Promise.all(schemas.map((name) => fingerprint(source.url, name))),
    Promise.all(schemas.map((name) => fingerprint(target.url, name))),
  ]);
  const sourceFingerprint = combineFingerprints(sourceFingerprints);
  const restoredFingerprint = combineFingerprints(restoredFingerprints);
  if (!fingerprintsMatch(sourceFingerprint, restoredFingerprint)) {
    const sourceParts = new Map(sourceFingerprint.tables.map((table) => [table.name, table]));
    const restoredParts = new Map(restoredFingerprint.tables.map((table) => [table.name, table]));
    const differences = [...new Set([...sourceParts.keys(), ...restoredParts.keys()])]
      .filter((name) => {
        const sourcePart = sourceParts.get(name);
        const restoredPart = restoredParts.get(name);
        return !sourcePart || !restoredPart ||
          sourcePart.rows !== restoredPart.rows || sourcePart.sha256 !== restoredPart.sha256;
      });
    throw new Error(
      `Restore reconciliation failed: source ${sourceFingerprint.rowCount} rows/${sourceFingerprint.tableCount} tables, ` +
      `restored ${restoredFingerprint.rowCount} rows/${restoredFingerprint.tableCount} tables. ` +
      `Differing components: ${differences.join(', ') || 'aggregate fingerprint'}. ` +
      'Row values and fingerprints are intentionally omitted from this failure message.',
    );
  }
  console.log(JSON.stringify({
    result: 'restore-reconciled',
    sourceDatabase: source.database,
    restoreDatabase: target.database,
    schemas,
    tableCount: sourceFingerprint.tableCount,
    rowCount: sourceFingerprint.rowCount,
    checkedComponents: sourceFingerprint.tables.length,
    sha256: sourceFingerprint.sha256,
  }));
}

function combineFingerprints(parts: Awaited<ReturnType<typeof fingerprint>>[]) {
  const digest = createHash('sha256');
  for (const part of parts) {
    digest.update(part.schema);
    digest.update('\0');
    digest.update(part.sha256);
    digest.update('\n');
  }
  return {
    tableCount: parts.reduce((sum, part) => sum + part.tableCount, 0),
    rowCount: parts.reduce((sum, part) => sum + part.rowCount, 0),
    sha256: digest.digest('hex'),
    tables: parts.flatMap((part) => part.tables.map((component) => ({
      ...component,
      name: `${part.schema}:${component.name}`,
    }))),
  };
}

function fingerprintsMatch(
  source: ReturnType<typeof combineFingerprints>,
  restored: ReturnType<typeof combineFingerprints>,
): boolean {
  if (source.tableCount !== restored.tableCount || source.rowCount !== restored.rowCount) return false;
  const sourceParts = new Map(source.tables.map((component) => [component.name, component]));
  const restoredParts = new Map(restored.tables.map((component) => [component.name, component]));
  return sourceParts.size === restoredParts.size &&
    [...sourceParts].every(([name, part]) => {
      const counterpart = restoredParts.get(name);
      return counterpart?.rows === part.rows && counterpart.sha256 === part.sha256;
    });
}

if (import.meta.main) {
  runRecoveryRehearsal().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Recovery rehearsal failed.');
    process.exitCode = 1;
  });
}
