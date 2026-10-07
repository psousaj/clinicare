import { describe, expect, it } from 'bun:test';
import { parseManageArgs } from './manage';

describe('manage CLI arguments', () => {
  it('parses group, action and --option value pairs', () => {
    const parsed = parseManageArgs(['admin', 'create', '--tenant-id', 't1', '--name', 'Ana', '--email', 'ana@x.com']);
    expect(parsed.group).toBe('admin');
    expect(parsed.action).toBe('create');
    expect(parsed.options.get('tenant-id')).toBe('t1');
    expect(parsed.options.get('name')).toBe('Ana');
  });

  it('rejects missing group/action and bare values', () => {
    expect(() => parseManageArgs(['tenant'])).toThrow('Uso: manage');
    expect(() => parseManageArgs(['tenant', 'create', 'oops'])).toThrow('Opção inválida');
  });
});
