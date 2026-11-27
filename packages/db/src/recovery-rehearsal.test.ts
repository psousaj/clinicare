import { describe, expect, it } from 'bun:test';
import {
  assertRecoveryTargets,
  parseRecoveryTarget,
  redactDiagnostics,
  stableSerialize,
} from './recovery-rehearsal';

describe('recovery rehearsal safety guards', () => {
  it('serializes metadata independent of object key order', () => {
    expect(stableSerialize({ b: 2, a: { y: 1, x: 0 } }))
      .toBe(stableSerialize({ a: { x: 0, y: 1 }, b: 2 }));
  });

  it('redacts PostgreSQL URLs and password assignments in command diagnostics', () => {
    const diagnostic = 'failed postgresql://clinic:topsecret@localhost/db and password=topsecret';
    const redacted = redactDiagnostics(diagnostic, ['postgresql://clinic:topsecret@localhost/db']);
    expect(redacted).not.toContain('topsecret');
    expect(redacted).toContain('[REDACTED]');
  });

  it('accepts loopback PostgreSQL source and a separately named restore database', () => {
    const source = parseRecoveryTarget('postgresql://local:local@localhost:5432/clinicare', 'source');
    const target = parseRecoveryTarget('postgresql://local:local@localhost:55432/clinicare_restore_trial', 'target');
    target.port = source.port;
    expect(() => assertRecoveryTargets(source, target)).not.toThrow();
  });

  it('accepts IPv6 loopback as a local endpoint', () => {
    expect(parseRecoveryTarget('postgresql://local:local@[::1]:5432/clinicare', 'source').host)
      .toBe('[::1]');
  });

  it('refuses remote source and restore targets', () => {
    expect(() => parseRecoveryTarget('postgresql://user:pass@db.example/clinicare', 'source'))
      .toThrow('must resolve to loopback');
    expect(() => parseRecoveryTarget('postgresql://user:pass@db.example/clinicare_restore_trial', 'target'))
      .toThrow('must resolve to loopback');
  });

  it('refuses restoring into the source database or a database without the restore prefix', () => {
    const source = parseRecoveryTarget('postgresql://local:local@localhost:5432/clinicare', 'source');
    const same = parseRecoveryTarget('postgresql://local:local@localhost:5432/clinicare', 'target');
    const unsafeName = parseRecoveryTarget('postgresql://local:local@localhost:55432/clinicare_rehearsal', 'target');
    unsafeName.port = source.port;
    expect(() => assertRecoveryTargets(source, same)).toThrow('different databases');
    expect(() => assertRecoveryTargets(source, unsafeName)).toThrow('must start with clinicare_restore_');
  });

  it('refuses another source database and a restore server other than the source server', () => {
    const source = parseRecoveryTarget('postgresql://local:local@localhost:5432/other', 'source');
    const target = parseRecoveryTarget('postgresql://local:local@localhost:5432/clinicare_restore_trial', 'target');
    expect(() => assertRecoveryTargets(source, target)).toThrow('source must be the explicitly named clinicare');
    const clinicare = parseRecoveryTarget('postgresql://local:local@localhost:5432/clinicare', 'source');
    const remoteServer = parseRecoveryTarget('postgresql://local:local@localhost:55432/clinicare_restore_trial', 'target');
    expect(() => assertRecoveryTargets(clinicare, remoteServer)).toThrow('same PostgreSQL server');
  });
});
