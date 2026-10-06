import { createHash } from 'node:crypto';
import { PDF } from '@libpdf/core';

export type PdfPlacement = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PdfRect = { x: number; y: number; width: number; height: number };

const invalid = (message: string, status = 400) => Object.assign(new Error(message), { status });

export function normalizedPlacementToPdfRect(placement: PdfPlacement, page: { getCropBox(): PdfRect; getRotation?: () => number }): PdfRect {
  const crop = page.getCropBox();
  const rotation = (((page.getRotation?.() ?? 0) % 360) + 360) % 360;
  const displayWidth = rotation === 90 || rotation === 270 ? crop.height : crop.width;
  const displayHeight = rotation === 90 || rotation === 270 ? crop.width : crop.height;
  const points = [
    [placement.x * displayWidth, placement.y * displayHeight],
    [(placement.x + placement.width) * displayWidth, placement.y * displayHeight],
    [placement.x * displayWidth, (placement.y + placement.height) * displayHeight],
    [(placement.x + placement.width) * displayWidth, (placement.y + placement.height) * displayHeight],
  ].map(([u, v]) => {
    switch (rotation) {
      case 90: return [v, u];
      case 180: return [crop.width - u, v];
      case 270: return [crop.height - v, crop.width - u];
      default: return [u, crop.height - v];
    }
  });
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = crop.x + Math.min(...xs);
  const y = crop.y + Math.min(...ys);
  return { x, y, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export function validatePlacement(placement: unknown, pageCount: number): PdfPlacement {
  if (!placement || typeof placement !== 'object') throw Object.assign(new Error('Posicionamento inválido.'), { status: 400 });
  const value = placement as Record<string, unknown>;
  const numbers = ['pageIndex', 'x', 'y', 'width', 'height'].map((key) => value[key]);
  if (!numbers.every((item) => typeof item === 'number' && Number.isFinite(item))) throw Object.assign(new Error('Posicionamento inválido.'), { status: 400 });
  const result = value as unknown as PdfPlacement;
  if (!Number.isInteger(result.pageIndex) || result.pageIndex < 0 || result.pageIndex >= pageCount || result.width <= 0 || result.height <= 0 || result.x < 0 || result.y < 0 || result.x + result.width > 1 || result.y + result.height > 1) {
    throw Object.assign(new Error('Posicionamento fora dos limites da página.'), { status: 400 });
  }
  return result;
}

/**
 * Applies a visual signature as an incremental PDF update. LibPDF keeps the
 * source byte sequence as the prefix of an incremental save; the explicit
 * assertion protects this seam if the library behavior changes.
 */
export async function createIncrementalSignaturePdf(baseBytes: Uint8Array, signaturePng: Uint8Array, placementInput: unknown) {
  const pdf = await PDF.load(baseBytes);
  const incrementalBlocker = pdf.canSaveIncrementally();
  if (incrementalBlocker) throw Object.assign(new Error(`Este PDF não permite mutação incremental: ${incrementalBlocker}.`), { status: 409 });
  const pages = pdf.getPages();
  const placement = validatePlacement(placementInput, pages.length);
  const page = pages[placement.pageIndex]!;
  const rect = normalizedPlacementToPdfRect(placement, page);
  const image = pdf.embedPng(signaturePng);
  page.drawImage(image, { x: rect.x, y: rect.y, width: rect.width, height: rect.height });
  const output = await pdf.save({ incremental: true });
  if (output.byteLength <= baseBytes.byteLength || !baseBytes.every((byte, index) => output[index] === byte)) throw new Error('O motor de PDF não preservou o prefixo incremental.');
  return { bytes: output, hash: sha256(output), size: output.byteLength, placement };
}
