import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type DocxToPdfConverter = { convertDocxToPdf(docx: Uint8Array): Promise<Uint8Array> };

export const LIBREOFFICE_DEFAULT_TIMEOUT_MS = 60_000;
const JOB_DIR_PREFIX = 'clinicare-docx-pdf-';

export function createLibreOfficeConverter(options: { timeoutMs?: number } = {}): DocxToPdfConverter {
  const timeoutMs = options.timeoutMs ?? LIBREOFFICE_DEFAULT_TIMEOUT_MS;
  return {
    async convertDocxToPdf(docx: Uint8Array): Promise<Uint8Array> {
      if (!docx || docx.byteLength === 0) throw new Error('PDF conversion failed: empty DOCX input.');
      // Diretório de job isolado por conversão: binário temporário + perfil
      // `UserInstallation` vivem aqui, então conversões paralelas nunca
      // disputam lock de perfil do LibreOffice (sem fila/mutex).
      const jobDir = await mkdtemp(join(tmpdir(), JOB_DIR_PREFIX));
      const profileDir = join(jobDir, 'profile');
      const inputPath = join(jobDir, 'materialized.docx');
      const outputPath = join(jobDir, 'materialized.pdf');
      try {
        await writeFile(inputPath, docx);
        // Comando direto via argv, sem shell e sem interpolação: nenhum byte
        // do documento ou do caminho passa por interpretação de shell.
        await runSoffice([
          `-env:UserInstallation=file://${profileDir}`,
          '--headless',
          '--norestore',
          '--convert-to', 'pdf',
          '--outdir', jobDir,
          inputPath,
        ], timeoutMs);
        let pdf: Uint8Array;
        try {
          pdf = await readFile(outputPath);
        } catch {
          throw new Error('PDF conversion failed: soffice did not produce a PDF output.');
        }
        if (pdf.byteLength < 5 || new TextDecoder().decode(pdf.subarray(0, 5)) !== '%PDF-') {
          throw new Error('PDF conversion failed: soffice produced an invalid PDF.');
        }
        return pdf;
      } finally {
        await rm(jobDir, { recursive: true, force: true });
      }
    },
  };
}

async function runSoffice(args: string[], timeoutMs: number): Promise<void> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(['soffice', ...args], { stdout: 'ignore', stderr: 'pipe' });
  } catch (error) {
    throw new Error(`PDF conversion failed: unable to start soffice (${error instanceof Error ? error.message : String(error)}).`);
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    // DOCX corrompido pode pendurar o `soffice`: aborta com kill e registra
    // falha explícita em vez de travar a materialização.
    timedOut = true;
    try { proc.kill(9); } catch { /* already exited */ }
  }, timeoutMs);
  let exitCode: number | null;
  try {
    exitCode = await proc.exited;
  } catch (error) {
    throw new Error(`PDF conversion failed: unable to start soffice (${error instanceof Error ? error.message : String(error)}).`);
  } finally {
    clearTimeout(timer);
  }
  if (timedOut) {
    throw new Error(`PDF conversion failed: timed out after ${timeoutMs}ms and the conversion was aborted.`);
  }
  if (exitCode !== 0) {
    const stream = proc.stderr instanceof ReadableStream ? proc.stderr : null;
    const stderr = stream ? await new Response(stream).text().catch(() => '') : '';
    const detail = stderr.trim() ? ` ${stderr.trim().slice(-500)}` : '';
    throw new Error(`PDF conversion failed: soffice exited with code ${exitCode}.${detail}`);
  }
}
