import { describe, expect, it } from 'vitest';
import { buildField, formatCpf, formatPhone, isValidCpf, validateFormSchema } from './fieldKinds';

describe('field kinds', () => {
  it('formats phone and cpf while typing', () => {
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('1198765')).toBe('(11) 9876-5');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
  });

  it('validates cpf check digits', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
  });

  it('requires at least two distinct, filled options for choice fields', () => {
    const schema = (options: string[]) => ({ properties: { a: buildField('choice', 'Turno', options) } });
    expect(validateFormSchema(schema(['Manhã', 'Tarde']))).toBeNull();
    expect(validateFormSchema(schema(['Manhã']))).toMatch(/duas opções/);
    expect(validateFormSchema(schema(['Manhã', '']))).toMatch(/duas opções/);
    expect(validateFormSchema(schema(['Manhã', 'Manhã']))).toMatch(/repetidas/);
  });

  it('builds time fields validated as HH:mm', () => {
    const field = buildField('time', 'Horário');
    const pattern = new RegExp(String(field.pattern));
    expect(field['x-kind']).toBe('time');
    expect(pattern.test('09:30')).toBe(true);
    expect(pattern.test('24:00')).toBe(false);
    expect(pattern.test('9:5')).toBe(false);
  });
});
