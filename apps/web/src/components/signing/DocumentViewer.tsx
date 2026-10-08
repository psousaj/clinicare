// Núcleo compartilhado da cerimônia de assinatura (paciente + representante).
// DocumentViewer: scroll contínuo, páginas empilhadas sobre fundo cinza,
// sem abas; o progresso alimenta o checklist e o stepper.
import { useRef } from 'react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
}

export type PageGeometry = { width: number; height: number };

export function usePdfDocument(url: string | null) {
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const pageCanvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const pageWrapperRefs = useRef<Array<HTMLDivElement | null>>([]);
  const viewerScrollRef = useRef<HTMLDivElement>(null);
  const viewerEndRef = useRef<HTMLDivElement>(null);

  return { pdfRef, pageCanvasRefs, pageWrapperRefs, viewerScrollRef, viewerEndRef };
}

export function DocumentViewer({
  pdfUrl,
  pageCount,
  pageGeometries,
  pageCanvasRefs,
  pageWrapperRefs,
  viewerScrollRef,
  viewerEndRef,
  currentPage,
  progress,
  readLabel,
  hint,
  pdfError,
  downloadUrl,
}: {
  pdfUrl: string | null;
  pageCount: number;
  pageGeometries: PageGeometry[];
  pageCanvasRefs: React.MutableRefObject<Array<HTMLCanvasElement | null>>;
  pageWrapperRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  viewerScrollRef: React.RefObject<HTMLDivElement | null>;
  viewerEndRef: React.RefObject<HTMLDivElement | null>;
  currentPage: number;
  progress: number;
  readLabel: string;
  hint: string | null;
  pdfError: string | null;
  downloadUrl?: string | null;
}) {
  return (
    <div className="min-h-0 overflow-hidden rounded-2xl border border-[#e3e9e4] bg-white shadow-[0_1px_2px_rgba(20,40,30,0.04),0_16px_40px_-24px_rgba(20,40,30,0.25)]">
      <div className="flex items-center gap-3 border-b border-[#eef1ed] px-4 py-3 sm:px-5">
        <span className="flex-none whitespace-nowrap text-sm font-semibold tabular-nums text-[#1f2a26]" role="status">
          Página {Math.min(currentPage + 1, Math.max(pageCount, 1))} de {pageCount || '…'}
        </span>
        <span
          className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-[#eef1ed]"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso de leitura"
        >
          <span
            className="block h-full rounded-full bg-[#26785f] transition-[width] duration-300 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </span>
        {downloadUrl && (
          <a
            className="-mr-2 inline-flex h-10 flex-none items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#26785f] no-underline transition-colors duration-150 hover:bg-[#eef5f1] hover:text-[#194d40]"
            href={downloadUrl}
            download
          >
            Baixar PDF
          </a>
        )}
      </div>
      <div ref={viewerScrollRef} className="min-h-0 bg-[#f2f4f1] px-3 py-4 sm:px-8 sm:py-6">
        <div className="mx-auto grid max-w-[720px] gap-4">
          {pdfError && (
            <p className="m-0 rounded-xl bg-white p-3 text-sm text-[#b3261e]" role="alert">
              {pdfError}
            </p>
          )}
          {pageCount === 0 && !pdfError && <div className="aspect-[1/1.414] animate-pulse rounded-md bg-white/70" aria-hidden="true" />}
          {Array.from({ length: pageCount }, (_, index) => (
            <div
              key={index}
              ref={(el) => {
                pageWrapperRefs.current[index] = el;
              }}
              data-page-index={index}
              className="overflow-hidden rounded-md bg-white shadow-[0_0_0_1px_rgba(20,40,30,0.05),0_2px_8px_-2px_rgba(20,40,30,0.12)]"
            >
              <canvas
                ref={(el) => {
                  pageCanvasRefs.current[index] = el;
                }}
                className="block h-auto w-full"
                aria-label={`Página ${index + 1} de ${pageCount} do contrato`}
              />
            </div>
          ))}
          {pageGeometries.length > 0 && <span ref={viewerEndRef} aria-hidden="true" />}
        </div>
      </div>
      <div className="flex flex-col gap-1 border-t border-[#eef1ed] px-4 py-4 sm:px-5">
        <p className={`m-0 text-sm ${hint ? 'font-semibold text-[#8a5a00]' : 'text-[#5b6b64]'}`} role="status">
          {hint ?? readLabel}
        </p>
        {pdfUrl && <p className="m-0 text-xs text-[#85908b]">Posição automática: sua assinatura entra no rodapé da última página.</p>}
      </div>
    </div>
  );
}

// Renderiza todas as páginas uma vez que as geometrias são conhecidas.
export async function renderAllPages(
  pdf: PDFDocumentProxy | null,
  geometries: PageGeometry[],
  canvases: Array<HTMLCanvasElement | null>,
  onError: () => void,
): Promise<void> {
  if (!pdf || geometries.length === 0) return;
  for (let index = 0; index < geometries.length; index += 1) {
    const canvas = canvases[index];
    if (!canvas) continue;
    try {
      const pdfPage = await pdf.getPage(index + 1);
      const viewport = pdfPage.getViewport({ scale: 1.2 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvas, viewport }).promise;
    } catch {
      onError();
    }
  }
}

export { getDocument };
