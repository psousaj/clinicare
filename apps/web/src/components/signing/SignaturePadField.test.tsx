import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignaturePadField, type SignaturePadHandle } from './SignaturePadField';

type ResizeCallback = () => void;
let resizeCallback: ResizeCallback | undefined;
let padInstance: {
  data: Array<{ points: Array<{ x: number; y: number }>; minWidth: number; maxWidth: number; dotSize: number }>;
  fromDataCalls: Array<Array<{ points: Array<{ x: number; y: number }>; minWidth: number; maxWidth: number; dotSize: number }>>;
  fromDataUrlCalls: string[];
  listeners: Record<string, () => void>;
  clear: ReturnType<typeof vi.fn>;
  dispatch: (event: string) => void;
} | undefined;
const originalRequestFullscreenDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'requestFullscreen');
const originalFullscreenElementDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
const originalExitFullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'exitFullscreen');

vi.mock('signature_pad', () => ({
  default: class SignaturePadMock {
    data = [{ points: [{ x: 20, y: 40 }], minWidth: 1, maxWidth: 2, dotSize: 0 }];
    fromDataCalls: Array<typeof this.data> = [];
    fromDataUrlCalls: string[] = [];
    hasImage = false;
    listeners: Record<string, () => void> = {};
    clear = vi.fn(() => { this.data = []; this.hasImage = false; });

    constructor() {
      padInstance = this;
    }

    addEventListener(event: string, listener: () => void) { this.listeners[event] = listener; }
    removeEventListener() {}
    off() {}
    isEmpty() { return this.data.length === 0 && !this.hasImage; }
    toData() { return this.data; }
    toDataURL() { return 'data:image/png;base64,signature'; }
    fromData(data: typeof this.data) { this.fromDataCalls.push(data); this.data = data; }
    fromDataURL(dataUrl: string) { this.fromDataUrlCalls.push(dataUrl); this.hasImage = true; return Promise.resolve(); }
    dispatch(event: string) { this.listeners[event]?.(); }
  },
}));

describe('SignaturePadField', () => {
  afterEach(() => {
    cleanup();
    resizeCallback = undefined;
    padInstance = undefined;
    vi.unstubAllGlobals();
    if (originalRequestFullscreenDescriptor) Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', originalRequestFullscreenDescriptor);
    else Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
    if (originalFullscreenElementDescriptor) Object.defineProperty(document, 'fullscreenElement', originalFullscreenElementDescriptor);
    else Reflect.deleteProperty(document, 'fullscreenElement');
    if (originalExitFullscreenDescriptor) Object.defineProperty(document, 'exitFullscreen', originalExitFullscreenDescriptor);
    else Reflect.deleteProperty(document, 'exitFullscreen');
  });

  it('preserves the drawing at the new canvas scale after resize', () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeCallback) { resizeCallback = callback; }
      observe() {}
      disconnect() {}
    });

    let width = 100;
    let height = 200;
    const ref = createRef<SignaturePadHandle>();
    render(<SignaturePadField ref={ref} onStroke={vi.fn()} />);
    const canvas = screen.getByLabelText('Área para desenhar sua assinatura');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, get: () => height });

    resizeCallback?.();
    width = 200;
    height = 100;
    resizeCallback?.();

    const resized = padInstance?.fromDataCalls.at(-1)?.[0];
    expect(resized?.points[0]).toMatchObject({ x: 40, y: 20 });
    expect(resized?.minWidth).toBeCloseTo(1);
    expect(resized?.maxWidth).toBeCloseTo(2);
  });

  it('keeps the public controls for stroke capture and clearing', () => {
    const onStroke = vi.fn();
    const ref = createRef<SignaturePadHandle>();
    render(<SignaturePadField ref={ref} onStroke={onStroke} />);

    padInstance?.dispatch('endStroke');
    expect(onStroke).toHaveBeenCalledWith('data:image/png;base64,signature');
    expect(ref.current?.toDataURL()).toBe('data:image/png;base64,signature');

    ref.current?.clear();
    expect(padInstance?.clear).toHaveBeenCalledOnce();
    expect(ref.current?.isEmpty()).toBe(true);
    resizeCallback?.();
    expect(ref.current?.toDataURL()).toBeNull();
  });

  it('restores a loaded PNG when resizing before any stroke data exists', () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeCallback) { resizeCallback = callback; }
      observe() {}
      disconnect() {}
    });

    let width = 100;
    let height = 200;
    render(<SignaturePadField initialImage="data:image/png;base64,draft" onStroke={vi.fn()} />);
    const canvas = screen.getByLabelText('Área para desenhar sua assinatura');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, get: () => height });
    if (padInstance) padInstance.data = [];

    resizeCallback?.();
    width = 200;
    height = 100;
    resizeCallback?.();

    expect(padInstance?.fromDataUrlCalls).toContain('data:image/png;base64,draft');
  });

  it('restores the loaded PNG before overlaying new strokes after resize', async () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeCallback) { resizeCallback = callback; }
      observe() {}
      disconnect() {}
    });

    let width = 100;
    let height = 200;
    render(<SignaturePadField initialImage="data:image/png;base64,draft" onStroke={vi.fn()} />);
    const canvas = screen.getAllByLabelText('Área para desenhar sua assinatura').at(-1)!;
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, get: () => width });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, get: () => height });
    if (padInstance) padInstance.data = [{ points: [{ x: 20, y: 40 }], minWidth: 1, maxWidth: 2, dotSize: 0 }];

    resizeCallback?.();
    width = 200;
    height = 100;
    resizeCallback?.();
    await Promise.resolve();

    expect(padInstance?.fromDataUrlCalls).toContain('data:image/png;base64,draft');
    expect(padInstance?.fromDataCalls.at(-1)?.[0]?.points[0]).toMatchObject({ x: 40, y: 20 });
  });

  it('opens fullscreen on mobile, keeps actions local, and can be reopened', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const lock = vi.fn(() => Promise.resolve());
    const clear = vi.fn();
    const onStroke = vi.fn();
    vi.stubGlobal('screen', { orientation: { lock, unlock: vi.fn() } });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: requestFullscreen });
    render(<SignaturePadField onStroke={onStroke} onClear={clear} />);

    fireEvent.pointerDown(screen.getByLabelText('Área para desenhar sua assinatura'));
    fireEvent.pointerUp(screen.getByLabelText('Área para desenhar sua assinatura'));
    expect(requestFullscreen).toHaveBeenCalledOnce();
    await Promise.resolve();
    expect(lock).toHaveBeenCalledWith('landscape');
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByLabelText('Área para desenhar sua assinatura'));
    fireEvent.pointerUp(screen.getByLabelText('Área para desenhar sua assinatura'));
    padInstance?.dispatch('endStroke');
    expect(onStroke).toHaveBeenCalledWith('data:image/png;base64,signature');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(clear).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByLabelText('Área para desenhar sua assinatura'));
    fireEvent.pointerUp(screen.getByLabelText('Área para desenhar sua assinatura'));
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
  });

  it('uses the visual fallback when fullscreen is unavailable or rejected and leaves desktop unchanged', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {} }));
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: undefined });
    render(<SignaturePadField onStroke={vi.fn()} />);
    fireEvent.pointerDown(screen.getByLabelText('Área para desenhar sua assinatura'));
    fireEvent.pointerUp(screen.getByLabelText('Área para desenhar sua assinatura'));
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();

    cleanup();
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: vi.fn(() => Promise.reject(new Error('fullscreen denied'))) });
    render(<SignaturePadField onStroke={vi.fn()} />);
    fireEvent.pointerDown(screen.getByLabelText('Área para desenhar sua assinatura'));
    fireEvent.pointerUp(screen.getByLabelText('Área para desenhar sua assinatura'));
    await Promise.resolve();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();

    cleanup();
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} }));
    render(<SignaturePadField onStroke={vi.fn()} />);
    fireEvent.pointerDown(screen.getByLabelText('Área para desenhar sua assinatura'));
    fireEvent.pointerUp(screen.getByLabelText('Área para desenhar sua assinatura'));
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
  });

  it('closes when native fullscreen is exited', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {} }));
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
    const exitFullscreen = vi.fn(() => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exitFullscreen });
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: vi.fn(function (this: HTMLElement) {
      fullscreenElement = this;
      document.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    }) });
    render(<SignaturePadField onStroke={vi.fn()} />);
    fireEvent.pointerDown(screen.getByLabelText('Área para desenhar sua assinatura'));
    fireEvent.pointerUp(screen.getByLabelText('Área para desenhar sua assinatura'));
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument());
    expect(exitFullscreen).not.toHaveBeenCalled();
  });
});
