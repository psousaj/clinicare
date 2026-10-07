import { describe, expect, it } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import PizZip from 'pizzip';
import { createLibreOfficeConverter } from './docx-pdf';

// Pré-requisito: `soffice` instalado (imagem de runtime instala
// `libreoffice-writer`; dev via `apt-get install libreoffice-writer`).
// Estes testes exigem o binário real — sem skips silenciosos.

const JOB_DIR_PREFIX = 'clinicare-docx-pdf-';

function minimalDocx(paragraphText: string, font = 'Calibri'): Uint8Array {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/></w:rPr></w:r><w:r><w:t>${paragraphText}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generate({ type: 'uint8array' });
}

async function jobDirs(): Promise<string[]> {
  return (await readdir(tmpdir())).filter((name) => name.startsWith(JOB_DIR_PREFIX));
}

describe('LibreOffice DOCX to PDF conversion', () => {
  it('converts a real DOCX to a byte-valid PDF', async () => {
    const pdf = await createLibreOfficeConverter().convertDocxToPdf(minimalDocx('Contrato de teste'));
    expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(100);
  });

  it('converts a Calibri document without font substitution failure', async () => {
    const pdf = await createLibreOfficeConverter().convertDocxToPdf(minimalDocx('Calibri body', 'Calibri'));
    expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe('%PDF-');
  });

  it('completes parallel conversions without profile lock errors', async () => {
    const converter = createLibreOfficeConverter();
    const results = await Promise.all([
      converter.convertDocxToPdf(minimalDocx('Paralelo um')),
      converter.convertDocxToPdf(minimalDocx('Paralelo dois')),
      converter.convertDocxToPdf(minimalDocx('Paralelo três')),
    ]);
    for (const pdf of results) {
      expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe('%PDF-');
    }
  });

  it('fails explicitly on corrupted DOCX', async () => {
    const before = await jobDirs();
    // DOCX truncado: soffice não gera saída e o conversor falha explícito.
    const valid = minimalDocx('Corrompido');
    const corrupted = valid.slice(0, Math.floor(valid.length / 2));
    await expect(createLibreOfficeConverter().convertDocxToPdf(corrupted)).rejects.toThrow('PDF conversion failed');
    expect(await jobDirs()).toEqual(before);
  });

  it('rejects empty input without spawning soffice', async () => {
    await expect(createLibreOfficeConverter().convertDocxToPdf(new Uint8Array(0))).rejects.toThrow('PDF conversion failed: empty DOCX input.');
  });

  it('aborts hung conversions via timeout with kill', async () => {
    const before = await jobDirs();
    await expect(createLibreOfficeConverter({ timeoutMs: 1 }).convertDocxToPdf(minimalDocx('Timeout'))).rejects.toThrow(/timed out after 1ms/);
    expect(await jobDirs()).toEqual(before);
  });

  it('leaves no job residue after success', async () => {
    const before = await jobDirs();
    await createLibreOfficeConverter().convertDocxToPdf(minimalDocx('Limpeza'));
    expect(await jobDirs()).toEqual(before);
  });
});
