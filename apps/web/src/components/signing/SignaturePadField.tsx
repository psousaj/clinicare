// Campo de assinatura compartilhado: proporção ~2.5:1, linha-guia,
// placeholder que some ao desenhar, DPR-aware, touch-action none.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import SignaturePad, { type PointGroup } from 'signature_pad';

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  toDataURL: () => string | null;
  clear: () => void;
  loadImage: (dataUrl: string) => void;
  focus: () => void;
};

export const SignaturePadField = forwardRef<SignaturePadHandle, {
  onStroke: (dataUrl: string) => void;
  onClear?: () => void;
  initialImage?: string | null;
  label?: string;
  tall?: boolean;
  className?: string;
}>(function SignaturePadField({ onStroke, onClear, initialImage, label = 'Área para desenhar sua assinatura', tall, className }, ref, ) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const loadedImageRef = useRef<string | null>(initialImage ?? null);
  const [hasStroke, setHasStroke] = useState(false);
  const [mobileDevice, setMobileDevice] = useState(isMobileSignatureDevice);
  const [expanded, setExpanded] = useState(false);
  const onStrokeRef = useRef(onStroke);
  onStrokeRef.current = onStroke;

  function clearField() {
    padRef.current?.clear();
    loadedImageRef.current = null;
    setHasStroke(false);
  }

  useEffect(() => {
    const media = window.matchMedia('(hover: none) and (pointer: coarse)');
    const update = () => setMobileDevice(isMobileSignatureDevice());
    update();
    media.addEventListener?.('change', update);
    media.addListener?.(update);
    return () => {
      media.removeEventListener?.('change', update);
      media.removeListener?.(update);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement === fieldRef.current) setExpanded(true);
      else if (expanded && document.fullscreenElement !== fieldRef.current) {
        unlockLandscape();
        setExpanded(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [expanded]);

  function openExpanded() {
    if (!mobileDevice || expanded) return;
    const field = fieldRef.current;
    const requestFullscreen = field?.requestFullscreen;
    if (field && typeof requestFullscreen === 'function') {
      void requestFullscreen.call(field).then(() => lockLandscape()).catch(() => lockLandscape());
    } else {
      lockLandscape();
    }
    setExpanded(true);
  }

  function closeExpanded() {
    if (document.fullscreenElement === fieldRef.current && typeof document.exitFullscreen === 'function') {
      void document.exitFullscreen().catch(() => undefined);
    }
    unlockLandscape();
    setExpanded(false);
  }

  useImperativeHandle(ref, () => ({
    isEmpty: () => padRef.current?.isEmpty() ?? true,
    toDataURL: () => {
      const pad = padRef.current;
      if (!pad || pad.isEmpty()) return null;
      return pad.toDataURL('image/png');
    },
    clear: clearField,
    loadImage: (dataUrl: string) => {
      const pad = padRef.current;
      if (pad && typeof pad.fromDataURL === 'function') {
        loadedImageRef.current = dataUrl;
        pad.fromDataURL(dataUrl).catch(() => undefined);
        setHasStroke(true);
      }
    },
    focus: () => canvasRef.current?.focus(),
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePad(canvas, { minWidth: 0.7, maxWidth: 2.2, penColor: '#194d40' });
    let logicalSize = { width: 0, height: 0 };
    const resizeCanvas = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const previous = pad.isEmpty() ? null : pad.toData();
      const previousDataUrl = pad.isEmpty() ? null : pad.toDataURL('image/png');
      const scaleX = logicalSize.width ? width / logicalSize.width : 1;
      const scaleY = logicalSize.height ? height / logicalSize.height : 1;
      const strokeScale = Math.sqrt(scaleX * scaleY);
      const scaledPrevious = previous?.length ? scalePointGroups(previous, scaleX, scaleY, strokeScale) : null;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.getContext('2d')?.scale(ratio, ratio);
      logicalSize = { width, height };
      const imageToRestore = loadedImageRef.current ?? (scaledPrevious ? null : previousDataUrl);
      if (imageToRestore) {
        void pad.fromDataURL(imageToRestore, { width, height }).then(() => {
          if (scaledPrevious?.length) pad.fromData(scaledPrevious, { clear: false });
        });
      } else if (scaledPrevious?.length) {
        pad.fromData(scaledPrevious);
      }
    };
    const handleBegin = () => setHasStroke(true);
    const handleEnd = () => {
      if (!pad.isEmpty()) onStrokeRef.current(pad.toDataURL('image/png'));
    };
    pad.addEventListener?.('beginStroke', handleBegin);
    pad.addEventListener?.('endStroke', handleEnd);
    padRef.current = pad;
    const frame = window.requestAnimationFrame(resizeCanvas);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resizeCanvas) : null;
    observer?.observe(canvas);
    if (initialImage) {
      loadedImageRef.current = initialImage;
      if (typeof pad.fromDataURL === 'function') pad.fromDataURL(initialImage).catch(() => undefined);
      setHasStroke(true);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      pad.removeEventListener?.('beginStroke', handleBegin);
      pad.removeEventListener?.('endStroke', handleEnd);
      pad.off();
      padRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad || !initialImage || !pad.isEmpty() || typeof pad.fromDataURL !== 'function') return;
    loadedImageRef.current = initialImage;
    pad.fromDataURL(initialImage).then(() => setHasStroke(true)).catch(() => undefined);
  }, [initialImage]);

  return (
    <div ref={fieldRef} className={`relative ${expanded ? 'fixed inset-0 z-50 flex h-dvh max-h-[100dvh] flex-col gap-3 overflow-hidden bg-[#f2f4f1] p-4' : ''}`} style={expanded ? { paddingTop: 'max(1rem, env(safe-area-inset-top))', paddingRight: 'max(1rem, env(safe-area-inset-right))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', paddingLeft: 'max(1rem, env(safe-area-inset-left))' } : undefined}>
      <div className={expanded ? 'relative flex min-h-0 flex-1 flex-col' : 'relative'}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className={`w-full touch-none rounded-xl border border-[#cbd8d0] bg-[#fbfcfb] shadow-inner transition-[border-color,box-shadow] duration-150 focus-visible:border-[#26785f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#26785f]/15 ${tall ? 'h-64 sm:h-72' : 'h-48 sm:h-56'} ${className ?? ''} ${expanded ? 'min-h-0 flex-1' : ''}`}
        style={{ touchAction: 'none', ...(expanded ? { height: 'auto', minHeight: 0 } : {}) }}
        aria-label={label}
        onPointerDownCapture={(event) => {
          if (!mobileDevice || expanded) return;
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerUpCapture={(event) => {
          if (!mobileDevice || expanded) return;
          event.preventDefault();
          event.stopPropagation();
          openExpanded();
        }}
      />
      {!hasStroke && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
          <span className="flex w-[76%] items-center gap-2 border-b border-dotted border-[#9db8ab] pb-2 text-sm font-medium text-[#9db8ab]">
            <span className="text-base" aria-hidden="true">×</span>
            <span>Assine aqui</span>
          </span>
        </div>
      )}
      {expanded && (
        <div className="flex flex-none items-center justify-end gap-3 pt-1">
          <button type="button" className="min-h-11 rounded-lg border border-[#d8e2dc] bg-white px-4 text-sm font-semibold text-[#26785f]" onClick={() => { clearField(); onClear?.(); }}>Limpar</button>
          <button type="button" className="min-h-11 rounded-lg bg-[#26785f] px-5 text-sm font-semibold text-white" onClick={closeExpanded}>Confirmar</button>
        </div>
      )}
      </div>
    </div>
  );
});

function scalePointGroups(pointGroups: PointGroup[], scaleX: number, scaleY: number, strokeScale: number): PointGroup[] {
  return pointGroups.map((group) => ({
    ...group,
    minWidth: group.minWidth * strokeScale,
    maxWidth: group.maxWidth * strokeScale,
    dotSize: group.dotSize * strokeScale,
    points: group.points.map((point) => ({ ...point, x: point.x * scaleX, y: point.y * scaleY })),
  }));
}

function isMobileSignatureDevice(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
}

function lockLandscape() {
  const orientation = window.screen?.orientation;
  if (typeof orientation?.lock === 'function') void orientation.lock('landscape').catch(() => undefined);
}

function unlockLandscape() {
  const orientation = window.screen?.orientation;
  if (typeof orientation?.unlock === 'function') orientation.unlock();
}
