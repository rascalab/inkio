import { isSafeUrl } from '@inkio/core/ui';
import { fitsRaster, MAX_SOURCE_DIMENSION, MAX_SOURCE_PIXELS } from './raster-limits';

const imageCache = new Map<string, HTMLImageElement>();
const MAX_CACHE_SIZE = 10;
const MAX_CACHE_PIXELS = 12_000_000;
let cachedPixels = 0;
/** In-flight loads keyed by src so concurrent requests share one fetch. */
const pendingLoads = new Map<string, Promise<HTMLImageElement>>();

/** Link-only schemes core's isSafeUrl permits but that never yield an image. */
const NON_IMAGE_SCHEMES = new Set(['mailto:', 'tel:']);
const IMAGE_LOAD_TIMEOUT_MS = 30000;

/**
 * Same URL policy as the rest of Inkio (core `isSafeUrl`): http(s), blob:,
 * relative URLs and raster `data:image/*` payloads load; script schemes and
 * active-content data URLs (`image/svg+xml`, `text/html`, ...) are rejected,
 * so the image editor never opens a source the document itself would refuse
 * to render.
 */
function validateImageSrc(src: string): void {
  let protocol: string;
  try {
    // Relative URLs resolve against the page; only the scheme matters here.
    protocol = new URL(src, 'http://localhost').protocol;
  } catch {
    throw new Error('Cannot load image: invalid URL');
  }
  if (NON_IMAGE_SCHEMES.has(protocol) || !isSafeUrl(src)) {
    throw new Error('Cannot load image: blocked URL scheme');
  }
}

/**
 * Images that fell back to a non-CORS load taint every canvas they touch,
 * so raster export would throw late with no cause. The taint is recorded
 * at load time (WeakSet: no lifetime extension) and export fails early with
 * the actual reason instead of a bare SecurityError.
 */
const taintedImages = new WeakSet<HTMLImageElement>();

export function isImageTainted(image: HTMLImageElement): boolean {
  return taintedImages.has(image);
}

function cacheImage(src: string, image: HTMLImageElement): void {
  const pixels = image.naturalWidth * image.naturalHeight;
  if (pixels > MAX_CACHE_PIXELS) return;
  while (imageCache.size >= MAX_CACHE_SIZE || cachedPixels + pixels > MAX_CACHE_PIXELS) {
    const first = imageCache.entries().next().value;
    if (!first) break;
    cachedPixels -= first[1].naturalWidth * first[1].naturalHeight;
    imageCache.delete(first[0]);
  }
  imageCache.set(src, image);
  cachedPixels += pixels;
}

/** Failures reach the console; never include a source that may contain credentials. */
function loadImageElement(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image (network or invalid image)'));
    img.src = src;
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  try {
    validateImageSrc(src);
  } catch (error) {
    // Invalid schemes stay async rejections: loadImage never threw
    // synchronously before, and callers rely on promise semantics.
    return Promise.reject(error);
  }
  const cached = imageCache.get(src);
  if (cached) {
    // Move to end to maintain LRU order
    imageCache.delete(src);
    imageCache.set(src, cached);
    return Promise.resolve(cached);
  }
  const pending = pendingLoads.get(src);
  if (pending) {
    return pending;
  }

  // <img> loads cannot abort: on timeout the promise rejects and the late
  // completion becomes a no-op instead of hanging forever.
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const task = new Promise<HTMLImageElement>((resolveTask, rejectTask) => {
    const settle = (fn: () => void) => {
      if (pendingLoads.get(src) !== task) return;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      pendingLoads.delete(src);
      fn();
    };
    timeoutId = setTimeout(() => {
      settle(() => rejectTask(new Error('Timed out loading image')));
    }, IMAGE_LOAD_TIMEOUT_MS);
    loadSourceImage(src).then(
      (img) => settle(() => {
        // Only the winning request may populate the LRU, never a timed-out load.
        if (!/^(?:data|blob):/i.test(src)) cacheImage(src, img);
        resolveTask(img);
      }),
      (error: unknown) => settle(() => rejectTask(error)),
    );
  });
  pendingLoads.set(src, task);
  return task;
}

function loadSourceImage(src: string): Promise<HTMLImageElement> {
  const inline = /^data:/i.test(src);
  const load = !inline
    ? loadImageElement(src, true).catch(() => loadImageElement(src).then(
        (img) => {
          taintedImages.add(img);
          return img;
        },
        () => { throw new Error('Failed to load image (CORS and non-CORS requests failed)'); },
      ))
    : loadImageElement(src);

  return load.then((img) => {
    const { naturalWidth, naturalHeight } = img;
    if (!fitsRaster(naturalWidth, naturalHeight, MAX_SOURCE_DIMENSION, MAX_SOURCE_PIXELS)) {
      throw new RangeError(`Unsupported source image dimensions: ${naturalWidth}×${naturalHeight}`);
    }
    return img;
  });
}
