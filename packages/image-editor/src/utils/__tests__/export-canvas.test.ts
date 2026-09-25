import { describe, expect, it } from 'vitest';
import {
  MAX_EXPORT_DIMENSION,
  normalizeExportCrop,
  validateExportDimensions,
  validateExportFormat,
  validateExportQuality,
} from '../export-canvas';

describe('export guards', () => {
  it('accepts supported formats and rejects the rest', () => {
    expect(validateExportFormat('png')).toBe('png');
    expect(validateExportFormat('jpeg')).toBe('jpeg');
    expect(validateExportFormat('webp')).toBe('webp');
    expect(() => validateExportFormat('gif')).toThrow(/Unsupported export format/);
    expect(() => validateExportFormat('')).toThrow(/Unsupported export format/);
  });

  it('accepts qualities in [0, 1] and rejects out-of-range values', () => {
    expect(validateExportQuality(0)).toBe(0);
    expect(validateExportQuality(1)).toBe(1);
    expect(validateExportQuality(0.92)).toBe(0.92);
    expect(() => validateExportQuality(-0.1)).toThrow(/Invalid export quality/);
    expect(() => validateExportQuality(1.5)).toThrow(/Invalid export quality/);
    expect(() => validateExportQuality(Number.NaN)).toThrow(/Invalid export quality/);
  });

  it('accepts normal dimensions and rejects degenerate ones', () => {
    expect(() => validateExportDimensions(800, 600)).not.toThrow();
    expect(() => validateExportDimensions(0, 600)).toThrow(/Invalid export dimensions/);
    expect(() => validateExportDimensions(-10, 600)).toThrow(/Invalid export dimensions/);
  });

  it('rejects oversized sides before allocating a canvas', () => {
    expect(() => validateExportDimensions(MAX_EXPORT_DIMENSION + 1, 100)).toThrow(/max side/);
    expect(() => validateExportDimensions(100, MAX_EXPORT_DIMENSION + 1)).toThrow(/max side/);
  });

  it('clamps out-of-bounds crops into the image', () => {
    expect(normalizeExportCrop({ x: -10, y: -20, width: 900, height: 800 }, 800, 600)).toEqual({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    });
    expect(normalizeExportCrop({ x: 700, y: 500, width: 200, height: 200 }, 800, 600)).toEqual({
      x: 700,
      y: 500,
      width: 100,
      height: 100,
    });
  });

  it('rejects missing, degenerate, and non-finite crops', () => {
    expect(normalizeExportCrop(null, 800, 600)).toBeNull();
    expect(() => normalizeExportCrop({ x: 0, y: 0, width: 0, height: 100 }, 800, 600)).toThrow(
      /Invalid crop rect/,
    );
    expect(() =>
      normalizeExportCrop({ x: 0, y: 0, width: Number.NaN, height: 100 }, 800, 600),
    ).toThrow(/Invalid crop rect/);
  });

  it('rejects pixel counts that would OOM the encoder', () => {
    // Wide panorama: sides within the limit but pixel count over it.
    expect(() => validateExportDimensions(16000, 7000)).toThrow(/pixel limit/);
    expect(() => validateExportDimensions(16000, 6000)).not.toThrow();
  });
});
