import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewPdf, type PreviewPlacement } from './PreviewPdf';

const { renderPdfPage } = vi.hoisted(() => ({ renderPdfPage: vi.fn(() => ({ promise: Promise.resolve() })) }));

vi.mock('pdfjs-dist', () => ({
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getViewport: () => ({ width: 612, height: 792 }),
        render: renderPdfPage,
      }),
    }),
    destroy: () => Promise.resolve(),
  }),
}));

const placement: PreviewPlacement = { pageIndex: 0, x: 0.1, y: 0.2, width: 0.25, height: 0.12 };

function setPageGeometry(page: HTMLElement, width: number, height: number) {
  vi.spyOn(page, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => ({}),
  } as DOMRect);
  Object.defineProperty(page, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(page, 'clientHeight', { configurable: true, value: height });
}

describe('PreviewPdf placement', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([1, 2])('keeps drag placement normalized at zoom scale %s', async (zoom) => {
    const onPlacementChange = vi.fn();
    const { container } = render(<PreviewPdf url="/document.pdf" placement={placement} onPlacementChange={onPlacementChange} />);
    const page = (await screen.findByLabelText('Página 1 de 1 da prévia')).parentElement!;
    setPageGeometry(page, 600 * zoom, 800 * zoom);

    const overlay = screen.getByRole('slider', { name: 'Posição da assinatura' });
    expect(overlay).toHaveStyle({ left: '10%', top: '20%', width: '25%', height: '12%' });
    fireEvent.pointerDown(overlay, { pointerId: 1, clientX: 100 * zoom, clientY: 100 * zoom });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 160 * zoom, clientY: 180 * zoom });
    fireEvent.pointerUp(window, { pointerId: 1 });

    await waitFor(() => expect(onPlacementChange).toHaveBeenCalled());
    const dragged = onPlacementChange.mock.lastCall![0];
    expect(dragged.x).toBeCloseTo(0.2);
    expect(dragged.y).toBeCloseTo(0.3);
    expect(container.querySelectorAll('[data-preview-page]')).toHaveLength(1);
  });

  it('resizes the signature overlay in normalized page coordinates', async () => {
    const onPlacementChange = vi.fn();
    const { container } = render(<PreviewPdf url="/document.pdf" placement={placement} onPlacementChange={onPlacementChange} />);
    const page = (await screen.findByLabelText('Página 1 de 1 da prévia')).parentElement!;
    setPageGeometry(page, 600, 800);

    const southeastHandle = container.querySelectorAll('span.cursor-nwse-resize').item(1);
    expect(southeastHandle).not.toBeNull();
    fireEvent.pointerDown(southeastHandle!, { pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 160, clientY: 140 });
    fireEvent.pointerUp(window, { pointerId: 2 });

    await waitFor(() => expect(onPlacementChange).toHaveBeenCalled());
    const resized = onPlacementChange.mock.lastCall![0];
    expect(resized.x).toBeCloseTo(0.1);
    expect(resized.y).toBeCloseTo(0.2);
    expect(resized.width).toBeCloseTo(0.35);
    expect(resized.height).toBeCloseTo(0.17);
  });
});
