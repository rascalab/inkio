import Konva from 'konva';
import type { EffectiveFilter } from './filters';
import { getBaseDisplayDimensions } from './geometry';
import type { ExportScene, RasterCanvas } from './export-raster';

const BAND_PIXELS = 128 * 1024;
const TASK_BUDGET_MS = 8;

type ExportSource = HTMLImageElement | ImageBitmap;

export function yieldExportTask(): Promise<void> {
  // https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield
  const { scheduler } = globalThis as typeof globalThis & { scheduler?: { yield?(): Promise<void> } };
  return scheduler?.yield?.() ?? new Promise((resolve) => { setTimeout(resolve, 0); });
}

export async function renderFilteredBase(
  state: ExportScene,
  source: ExportSource,
  { filters, values }: EffectiveFilter,
): Promise<RasterCanvas> {
  const { crop, rotation } = state.transform;
  const { width, height } = getBaseDisplayDimensions(state.width, state.height, rotation);
  const canvas = typeof OffscreenCanvas !== 'undefined' && typeof OffscreenCanvas.prototype.convertToBlob === 'function'
    ? new OffscreenCanvas(0, 0) : document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not create a filter canvas context.');
    // Scale/crop once before splitting the pixel work, so interpolation can't seam at band edges.
    if (crop) context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    else context.drawImage(source, 0, 0, width, height);
    await yieldExportTask();

    const node = new Konva.Image({
      image: source,
      brightness: values.brightness, contrast: values.contrast, saturation: values.saturation,
      luminance: values.luminance, enhance: values.clarity,
    });
    // The presets are point filters. Clarity (the last stage) alone depends on full-image extrema.
    const clarity = values.clarity !== 0;
    const pointFilters = clarity ? filters.slice(0, -1) : filters;
    const pendingBands: ImageData[] | undefined = clarity ? [] : undefined;
    const min = [255, 255, 255];
    const max = [0, 0, 0];
    const rows = Math.max(1, Math.floor(BAND_PIXELS / width));
    let start = performance.now();
    for (let y = 0; y < height; y += rows) {
      const band = context.getImageData(0, y, width, Math.min(rows, height - y));
      for (const filter of pointFilters) {
        if (typeof filter !== 'function') throw new Error('Expected a pixel filter.');
        filter.call(node, band, 1);
      }
      if (pendingBands) {
        const { data } = band;
        for (let i = 0; i < data.length; i += 4) {
          for (let channel = 0; channel < 3; channel++) {
            const value = data[i + channel];
            if (value < min[channel]) min[channel] = value;
            if (value > max[channel]) max[channel] = value;
          }
        }
        // Do not round-trip unpremultiplied pixels through the canvas before clarity.
        pendingBands.push(band);
      } else {
        context.putImageData(band, 0, y);
      }
      if (performance.now() - start >= TASK_BUDGET_MS) {
        await yieldExportTask();
        start = performance.now();
      }
    }

    if (pendingBands) {
      // One sample contains all observed values and the same extrema as the full image.
      // Let Konva compute its own mapping once, keeping the worker and DOM outputs in sync.
      const lut = new ImageData(256, 1);
      for (let value = 0; value < 256; value++) {
        for (let channel = 0; channel < 3; channel++) {
          lut.data[value * 4 + channel] = Math.max(min[channel], Math.min(max[channel], value));
        }
      }
      const enhance = Konva.Filters.Enhance;
      if (typeof enhance !== 'function') throw new Error('Expected a clarity filter.');
      enhance.call(node, lut, 1);
      for (let index = 0; index < pendingBands.length; index++) {
        const band = pendingBands[index];
        const { data } = band;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = lut.data[data[i] * 4];
          data[i + 1] = lut.data[data[i + 1] * 4 + 1];
          data[i + 2] = lut.data[data[i + 2] * 4 + 2];
        }
        context.putImageData(band, 0, index * rows);
        if (performance.now() - start >= TASK_BUDGET_MS) {
          await yieldExportTask();
          start = performance.now();
        }
      }
    }
    return canvas;
  } catch (error) {
    canvas.width = canvas.height = 0;
    throw error;
  }
}
