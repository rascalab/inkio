// A complete 1×1 PNG, shared by upload integration tests.
export const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=';

export function rasterPngFile(name = 'pixel.png', type = 'image/png'): File {
  return new File([Uint8Array.from(atob(pngBase64), (char) => char.charCodeAt(0))], name, { type });
}
