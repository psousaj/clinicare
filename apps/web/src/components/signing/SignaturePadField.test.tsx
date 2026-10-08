import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
});
