import { isSafeUrl } from '@inkio/core';

const imageCache = new Map<string, HTMLImageElement>();
const MAX_CACHE_SIZE = 10;
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
    throw new Error(`Cannot load image: invalid URL ${describeSrc(src)}`);
  }
  if (NON_IMAGE_SCHEMES.has(protocol) || !isSafeUrl(src)) {
    throw new Error(`Cannot load image: blocked URL scheme ${protocol} (${describeSrc(src)})`);
  }
}

/**
 * Images that fell back to a non-CORS load taint every canvas they touch,
 * so exportCanvas.toDataURL throws late with no cause. The taint is recorded
 * at load time (WeakSet: no lifetime extension) and export fails early with
 * the actual reason instead of a bare SecurityError.
 */
const taintedImages = new WeakSet<HTMLImageElement>();

export function isImageTainted(image: HTMLImageElement): boolean {
  return taintedImages.has(image);
}

function evictOldest(): void {
  if (imageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey !== undefined) {
      imageCache.delete(firstKey);
    }
  }
}

function describeSrc(src: string): string {
  return src.length > 80 ? `${src.slice(0, 80)}…` : src;
}

function loadImageWithCORS(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Failed to load image (CORS or network): ${describeSrc(src)}`));
    img.src = src;
  });
}

function loadImageRaw(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`Failed to load image (unreachable URL): ${describeSrc(src)}`));
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
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      if (pendingLoads.get(src) === task) {
        pendingLoads.delete(src);
      }
      fn();
    };
    timeoutId = setTimeout(() => {
      settle(() => rejectTask(new Error(`Timed out loading image ${describeSrc(src)}`)));
    }, IMAGE_LOAD_TIMEOUT_MS);
    const load = cacheableLoad(src);
    load.then(
      (img) => settle(() => resolveTask(img)),
      (error: unknown) => settle(() => rejectTask(error)),
    );
  });
  pendingLoads.set(src, task);
  return task;
}

function cacheableLoad(src: string): Promise<HTMLImageElement> {
  // Data URLs never taint and the caller already holds the bytes: caching
  // them only pins decoded bitmaps with no byte-size eviction.
  const cacheable = !src.startsWith('data:');
  const load = cacheable
    ? loadImageWithCORS(src).catch((corsError: unknown) =>
        loadImageRaw(src).then((img) => {
          taintedImages.add(img);
          return img;
        }).catch((rawError: unknown) => {
          throw new Error(
            `Failed to load image (CORS fallback also failed): ${describeSrc(src)}: ${String(corsError)} / ${String(rawError)}`,
          );
        }),
      )
    : loadImageRaw(src);

  return load.then((img) => {
    if (cacheable) {
      evictOldest();
      imageCache.set(src, img);
    }
    return img;
  });
}
