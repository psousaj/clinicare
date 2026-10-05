import { describe, expect, it } from 'bun:test';
import PizZip from 'pizzip';
import { CONTRACT_CONTEXT_INCOMPLETE, defaultContextConfiguration, inspectDocxPlaceholders, renderDocx, validateDocxPlaceholders } from './contract-materialization';

function docx(text: string) {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', `<document><body><p>${text}</p></body></document>`);
  return zip.generate({ type: 'uint8array' });
}

describe('contract DOCX materialization', () => {
  const contexts = { ...defaultContextConfiguration(), patient: { enabled: true, required: true }, plan: { enabled: true, required: false } };
  it('discovers and renders scalar and collection placeholders', () => {
    const template = docx('{patient.name} {#plan.procedures}☒ {.}{/plan.procedures}');
    expect(inspectDocxPlaceholders(template)).toEqual(['patient.name', '#plan.procedures', '/plan.procedures']);
    const result = renderDocx(template, { patient: { name: 'Ana' }, plan: { procedures: ['Laser', 'Peeling'] } }, { contexts, allowedPlaceholders: ['patient.name', 'plan.procedures'], requiredPlaceholders: ['patient.name'] });
    expect(new TextDecoder().decode(result)).not.toContain('patient.name');
  });
  it('rejects unknown and disallowed placeholders during publication validation', () => {
    expect(() => validateDocxPlaceholders(docx('{patient.cpf}'), contexts, ['patient.name'], [])).toThrow('não permitido');
    expect(() => validateDocxPlaceholders(docx('{arbitrary.code}'), contexts, ['patient.name'], [])).toThrow('desconhecido');
  });
  it('returns empty optional values and rejects missing required context', () => {
    expect(() => renderDocx(docx('{patient.name}'), {}, { contexts, allowedPlaceholders: ['patient.name'], requiredPlaceholders: ['patient.name'] })).toThrow(CONTRACT_CONTEXT_INCOMPLETE);
    expect(() => renderDocx(docx('{patient.name}'), {}, { contexts: { ...contexts, patient: { enabled: true, required: false } }, allowedPlaceholders: ['patient.name'], requiredPlaceholders: [] })).not.toThrow();
  });
});
