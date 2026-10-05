import { describe, expect, it } from 'bun:test';
import { normalizedPlacementToPdfRect, validatePlacement } from './pdf-mutation';

describe('PDF signature placement', () => {
  it('accepts normalized placements within the visible page', () => {
    expect(validatePlacement({ page: 0, x: 0.1, y: 0.2, width: 0.25, height: 0.12 }, 1)).toEqual({ page: 0, x: 0.1, y: 0.2, width: 0.25, height: 0.12 });
  });

  it('rejects placements outside normalized bounds', () => {
    expect(() => validatePlacement({ page: 0, x: 0.9, y: 0.2, width: 0.2, height: 0.1 }, 1)).toThrow('Posicionamento fora dos limites da página.');
    expect(() => validatePlacement({ page: 1, x: 0, y: 0, width: 0.2, height: 0.1 }, 1)).toThrow('Posicionamento fora dos limites da página.');
  });

  it('converts top-left viewer coordinates using crop offsets and rotation', () => {
    const placement = { page: 0, x: 0.1, y: 0.2, width: 0.25, height: 0.1 } as const;
    const page = { getCropBox: () => ({ x: 10, y: 20, width: 600, height: 800 }), getRotation: () => 0 };
    expect(normalizedPlacementToPdfRect(placement, page)).toEqual({ x: 70, y: 580, width: 150, height: 80 });

    const rotatedPage = { getCropBox: () => ({ x: 10, y: 20, width: 600, height: 800 }), getRotation: () => 90 };
    expect(normalizedPlacementToPdfRect(placement, rotatedPage)).toMatchObject({ x: 130, y: 100, height: 200 });
    expect(normalizedPlacementToPdfRect(placement, rotatedPage).width).toBeCloseTo(60);
  });
});
