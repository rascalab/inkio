// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportCanvas } from '../export-canvas';
import { isImageTainted, loadImage } from '../image-loader';
import type { ImageEditorState } from '../../types';

class FakeImage {
  crossOrigin?: string;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  private rawSrc = '';
  set src(value: string) {
    this.rawSrc = value;
    queueMicrotask(() => {
      // CORS loads fail; raw loads succeed — mirrors a host without ACAO.
      if (this.crossOrigin === 'anonymous') {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    });
  }
  get src(): string {
    return this.rawSrc;
  }
}

vi.stubGlobal('Image', FakeImage);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal('Image', FakeImage);
});

function taintedState(image: HTMLImageElement): ImageEditorState {
  return {
    originalImage: image,
    originalWidth: 800,
    originalHeight: 600,
    transform: { rotation: 0, flipX: false, flipY: false, crop: null },
    outputSize: null,
  } as ImageEditorState;
}

describe('image taint tracking', () => {
  it('marks CORS-fallback loads as tainted at load time', async () => {
    const img = await loadImage('https://example.com/photo.png');
    expect(isImageTainted(img as unknown as HTMLImageElement)).toBe(true);
  });

  it('rejects export before raster work with the CORS cause', async () => {
    const img = await loadImage('https://example.com/photo.png');
    await expect(
      exportCanvas(taintedState(img as unknown as HTMLImageElement), 'png', 0.92),
    ).rejects.toThrow(/without CORS approval/);
  });
});
