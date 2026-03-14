const imageCache = new Map<string, HTMLImageElement>();
const MAX_CACHE_SIZE = 10;

function evictOldest(): void {
  if (imageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey !== undefined) {
      imageCache.delete(firstKey);
    }
  }
}

function loadImageWithCORS(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function loadImageRaw(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
    img.src = src;
  });
}

export function clearImageCache(): void {
  imageCache.clear();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) {
    // Move to end to maintain LRU order
    imageCache.delete(src);
    imageCache.set(src, cached);
    return Promise.resolve(cached);
  }

  const load = src.startsWith('data:')
    ? loadImageRaw(src)
    : loadImageWithCORS(src).catch(() => loadImageRaw(src));

  return load.then((img) => {
    evictOldest();
    imageCache.set(src, img);
    return img;
  });
}
