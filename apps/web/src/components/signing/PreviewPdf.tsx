import { useEffect, useRef, useState } from 'react';
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist';

export type PreviewPlacement = { pageIndex: number; x: number; y: number; width: number; height: number };

export function PreviewPdf({
  url,
  placement,
  signatureImage,
  onPlacementChange,
}: {
  url: string;
  placement: PreviewPlacement;
  signatureImage?: string | null;
  onPlacementChange: (position: Partial<PreviewPlacement>) => void;
}) {
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = getDocument({ url });
    void loadingTask.promise.then((pdf) => {
      if (cancelled) {
        if ('destroy' in pdf && typeof pdf.destroy === 'function') void pdf.destroy();
        return;
      }
      pdfRef.current = pdf;
      setPageCount(pdf.numPages);
    }).catch(() => {
      if (!cancelled) setError('Não foi possível mostrar a prévia do documento.');
    });
    return () => {
      cancelled = true;
      pdfRef.current = null;
      if (typeof loadingTask.destroy === 'function') void loadingTask.destroy();
    };
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    async function renderPages() {
      const pdf = pdfRef.current;
      if (!pdf || pageCount === 0) return;
      for (let index = 0; index < pageCount; index += 1) {
        const canvas = canvasRefs.current[index];
        if (!canvas) continue;
        try {
          const page = await pdf.getPage(index + 1);
          const viewport = page.getViewport({ scale: 1.2 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, viewport }).promise;
        } catch {
          if (!cancelled) setError('Não foi possível mostrar alguma página da prévia.');
          return;
        }
        if (cancelled) return;
      }
    }
    void renderPages();
    return () => { cancelled = true; };
  }, [pageCount]);

  useEffect(() => {
    const page = pageRefs.current[placement.pageIndex];
    const viewer = viewerRef.current;
    if (!page || !viewer) return;
    const timer = window.setTimeout(() => {
      const signatureTop = page.offsetTop + page.clientHeight * placement.y;
      if (typeof viewer.scrollTo === 'function') {
        viewer.scrollTo({ top: Math.max(0, signatureTop - viewer.clientHeight / 2), behavior: 'smooth' });
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [pageCount, placement.pageIndex]);

  if (error) return <p className="m-0 bg-[#fff7f7] p-4 text-sm text-[#b3261e]" role="alert">{error}</p>;
  if (pageCount === 0) return <div className="h-72 animate-pulse bg-[#f2f4f1]" aria-label="Carregando prévia" />;

  return (
    <div ref={viewerRef} className="h-[min(62vh,680px)] overflow-y-auto overscroll-contain bg-[#f2f4f1] px-3 py-4 sm:px-8 sm:py-6">
      <div className="mx-auto grid max-w-[720px] gap-4">
        {Array.from({ length: pageCount }, (_, index) => (
          <div key={index} ref={(page) => { pageRefs.current[index] = page; }} data-preview-page className="relative overflow-visible rounded-md bg-white shadow-[0_0_0_1px_rgba(20,40,30,0.05),0_2px_8px_-2px_rgba(20,40,30,0.12)]">
            <canvas ref={(canvas) => { canvasRefs.current[index] = canvas; }} className="block h-auto w-full" aria-label={`Página ${index + 1} de ${pageCount} da prévia`} />
            {index === placement.pageIndex && <DraggableSignature placement={placement} signatureImage={signatureImage} onPlacementChange={onPlacementChange} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function DraggableSignature({ placement, signatureImage, onPlacementChange }: { placement: PreviewPlacement; signatureImage?: string | null; onPlacementChange: (position: Partial<PreviewPlacement>) => void }) {
  type Interaction = { mode: 'drag' | 'resize'; corner?: string; pointerX: number; pointerY: number; x: number; y: number; width: number; height: number; pageWidth: number; pageHeight: number };

  function start(event: React.PointerEvent<HTMLElement>, mode: Interaction['mode'], corner?: string) {
    event.preventDefault();
    event.stopPropagation();
    const page = event.currentTarget.closest('[data-preview-page]');
    if (!page) return;
    const rect = page.getBoundingClientRect();
    // Keep the target outside the async pointerup handler. React may clear
    // the synthetic event's currentTarget after pointerdown, and the
    // signature overlay can also be re-rendered while it is being dragged.
    const target = event.currentTarget;
    target.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = 'none';
    const startState: Interaction = { mode, corner, pointerX: event.clientX, pointerY: event.clientY, x: placement.x, y: placement.y, width: placement.width, height: placement.height, pageWidth: rect.width, pageHeight: rect.height };
    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startState.pointerX) / startState.pageWidth;
      const dy = (moveEvent.clientY - startState.pointerY) / startState.pageHeight;
      if (startState.mode === 'drag') {
        onPlacementChange({ x: Math.min(1 - startState.width, Math.max(0, startState.x + dx)), y: Math.min(1 - startState.height, Math.max(0, startState.y + dy)) });
        return;
      }
      const left = startState.corner?.includes('l');
      const top = startState.corner?.includes('t');
      const right = startState.corner?.includes('r');
      const bottom = startState.corner?.includes('b');
      const width = Math.max(0.12, Math.min(1, startState.width + (right ? dx : left ? -dx : 0)));
      const height = Math.max(0.06, Math.min(1, startState.height + (bottom ? dy : top ? -dy : 0)));
      const x = left ? Math.min(1 - width, Math.max(0, startState.x + dx)) : Math.min(1 - width, Math.max(0, startState.x));
      const y = top ? Math.min(1 - height, Math.max(0, startState.y + dy)) : Math.min(1 - height, Math.max(0, startState.y));
      onPlacementChange({ x, y, width, height });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      try {
        if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture?.(event.pointerId);
      } catch {
        // The overlay may have been unmounted before pointerup.
      }
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    window.addEventListener('pointercancel', stop, { once: true });
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Posição da assinatura"
      aria-valuetext="Arraste para ajustar ou use as alças para redimensionar"
      className="absolute z-10 grid cursor-grab touch-none place-items-center rounded-md border-2 border-dashed border-[#26785f] bg-[#e8f2ed]/85 px-2 text-center font-semibold text-[#194d40] shadow-sm [container-type:inline-size] active:cursor-grabbing"
      style={{ left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, width: `${placement.width * 100}%`, height: `${placement.height * 100}%` }}
      onPointerDown={(event) => start(event, 'drag')}
    >
      {signatureImage ? (
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
          <img src={signatureImage} alt="Assinatura aplicada" className="block h-full w-full object-contain" />
        </span>
      ) : <span className="pointer-events-none whitespace-nowrap text-[clamp(6px,6cqw,12px)]">Assinatura</span>}
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <span key={corner} className={`absolute size-3 rounded-sm border-2 border-[#26785f] bg-white ${corner.includes('t') ? 'top-[-6px]' : 'bottom-[-6px]'} ${corner.includes('l') ? 'left-[-6px]' : 'right-[-6px]'} ${corner === 'tl' || corner === 'br' ? 'cursor-nwse-resize' : 'cursor-nesw-resize'}`} onPointerDown={(event) => start(event, 'resize', corner)} aria-hidden="true" />
      ))}
    </div>
  );
}
