import Konva from 'konva';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../reducer';
import {
  encodeCanvas,
  exportCanvas,
  MAX_EXPORT_DIMENSION,
  normalizeExportCrop,
  validateExportDimensions,
  validateExportFormat,
  validateExportQuality,
} from '../export-canvas';
import { encodeExportCanvas } from '../export-raster';

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
    expect(() => validateExportDimensions(MAX_EXPORT_DIMENSION, MAX_EXPORT_DIMENSION)).toThrow(/pixel limit/);
    expect(() => validateExportDimensions(MAX_EXPORT_DIMENSION, 3800)).not.toThrow();
  });
});

describe('browser encoder results', () => {
  it('rejects a PNG from a browser without the requested WebP encoder', async () => {
    const canvas = { toBlob: (callback: BlobCallback) => callback(new Blob(['image data'], { type: 'image/png' })) };
    await expect(encodeCanvas(canvas, 'image/webp', 0.92)).rejects.toThrow(/image\/webp/);
  });

  it('rejects a browser encoder that produced no bytes', async () => {
    const canvas = { toBlob: (callback: BlobCallback) => callback(null) };
    await expect(encodeCanvas(canvas, 'image/jpeg', 0.92)).rejects.toThrow(/image\/jpeg/);
  });
});

describe('save preview', () => {
  afterEach(() => vi.restoreAllMocks());

  it('encodes the full-size canvas and draws a separate bounded preview from the same pixels', async () => {
    const fullCanvas = { width: 3000, height: 4000 } as HTMLCanvasElement;
    const drawImage = vi.fn();
    const previewCanvas = { width: 0, height: 0, getContext: () => ({ drawImage }) } as unknown as HTMLCanvasElement;
    vi.spyOn(Konva.Util, 'createCanvasElement').mockReturnValue(previewCanvas);
    const full = new Blob(['original bytes'], { type: 'image/png' });
    const preview = new Blob(['preview bytes'], { type: 'image/png' });

    const result = await encodeExportCanvas(fullCanvas, 'blob-with-preview', async (canvas) => {
      if (canvas === fullCanvas) {
        expect([canvas.width, canvas.height]).toEqual([3000, 4000]);
        return full;
      }
      expect([canvas.width, canvas.height]).toEqual([900, 1200]);
      return preview;
    });

    expect(result).toEqual({ blob: full, preview });
    expect(drawImage).toHaveBeenCalledExactlyOnceWith(fullCanvas, 0, 0, 900, 1200);
    expect([fullCanvas.width, fullCanvas.height, previewCanvas.width, previewCanvas.height]).toEqual([0, 0, 0, 0]);
  });

  it('reuses the encoded full-size image when it already fits the preview', async () => {
    const canvas = { width: 640, height: 480 } as HTMLCanvasElement;
    const full = new Blob(['original bytes'], { type: 'image/png' });
    const encode = vi.fn(async () => full);

    const result = await encodeExportCanvas(canvas, 'blob-with-preview', encode);

    expect(result).toEqual({ blob: full, preview: full });
    expect(encode).toHaveBeenCalledTimes(1);
  });
});

describe('worker export input', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['inline', 'object URL', 'CSP-blocked inline', 'remote'] as const)(
    'preserves the string export for a %s image without refetching remote sources',
    async (caseName) => {
      const result = 'data:image/png;base64,AA==';
      const image = {
        currentSrc: caseName === 'remote' ? 'https://example.com/photo.png'
          : caseName === 'object URL' ? 'blob:http://localhost/local-photo' : result,
        naturalWidth: 2100,
        naturalHeight: 1000,
      } as HTMLImageElement;
      const readSource = vi.fn(async () => {
        if (caseName === 'CSP-blocked inline') throw new TypeError('Blocked by connect-src');
        return new Response(new Blob([new Uint8Array([0])], { type: 'image/png' }));
      });
      const createBitmap = vi.fn(async (_source: ImageBitmapSource) => ({
        width: image.naturalWidth, height: image.naturalHeight, close() {},
      }));
      class Worker {
        onmessage?: (message: { data: string }) => void;
        postMessage() { queueMicrotask(() => this.onmessage?.({ data: result })); }
        terminate() {}
      }

      vi.stubGlobal('window', globalThis);
      vi.stubGlobal('document', {});
      vi.stubGlobal('Worker', Worker);
      vi.stubGlobal('OffscreenCanvas', class { convertToBlob() {} });
      vi.stubGlobal('createImageBitmap', createBitmap);
      vi.stubGlobal('fetch', readSource);

      await expect(exportCanvas({
        ...createInitialState(),
        originalImage: image,
        originalWidth: image.naturalWidth,
        originalHeight: image.naturalHeight,
      })).resolves.toBe(result);

      if (caseName === 'remote') expect(readSource).not.toHaveBeenCalled();
      else expect(readSource).toHaveBeenCalledWith(image.currentSrc);
      expect(createBitmap).toHaveBeenCalledExactlyOnceWith(
        caseName === 'inline' || caseName === 'object URL' ? expect.any(Blob) : image,
      );
    },
  );
});
