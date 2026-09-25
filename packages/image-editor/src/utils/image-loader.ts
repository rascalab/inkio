const imageCache = new Map<string, HTMLImageElement>();
const MAX_CACHE_SIZE = 10;

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
  const cached = imageCache.get(src);
  if (cached) {
    // Move to end to maintain LRU order
    imageCache.delete(src);
    imageCache.set(src, cached);
    return Promise.resolve(cached);
  }

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
