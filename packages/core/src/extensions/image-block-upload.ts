import { toError, type InkioErrorHandler } from '../errors';
import { isSafeUrl } from '../utils/url-safety';

type ImageUploadResult = string | Record<string, unknown>;

/** `blockId` identifies one file in a transient insertion batch. */
export interface ImageUploadContext {
  blockId?: string;
}

export interface ImageUploadOptions {
  /** Uploads new or edited images. The server must independently validate the bytes and limits. */
  onUpload?: (file: File, context?: ImageUploadContext) => Promise<ImageUploadResult>;
  resolveFileUrl?: (url: string) => Promise<string>;
  /** Further restricts the recognized raster formats; it cannot enable unrecognized formats. */
  allowedMimeTypes?: string[];
  maxFileSize?: number;
  onUploadError?: (error: Error) => void;
  onError?: InkioErrorHandler;
}

type ImageNodeAttributes = {
  src: string;
  alt?: string;
  title?: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  caption?: string;
};

const KNOWN_IMAGE_ATTR_KEYS = ['src', 'alt', 'title', 'width', 'align', 'caption'] as const;

function toImageNodeAttributes(result: ImageUploadResult, fallbackAlt?: string): Partial<ImageNodeAttributes> {
  if (typeof result === 'string') {
    return fallbackAlt === undefined ? { src: result } : { src: result, alt: fallbackAlt };
  }

  const attrs: Partial<ImageNodeAttributes> = {};
  for (const key of KNOWN_IMAGE_ATTR_KEYS) {
    if (!(key in result)) continue;
    const value = result[key];
    if (key === 'src' && typeof value === 'string') attrs.src = value;
    if (key === 'alt' && typeof value === 'string') attrs.alt = value;
    if (key === 'title' && typeof value === 'string') attrs.title = value;
    if (key === 'width' && (typeof value === 'string' || typeof value === 'number')) attrs.width = value;
    if (key === 'align' && (value === 'left' || value === 'center' || value === 'right')) attrs.align = value;
    if (key === 'caption' && typeof value === 'string') attrs.caption = value;
  }
  if (!attrs.alt && fallbackAlt) attrs.alt = fallbackAlt;
  return attrs;
}

function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function readImageHeader(file: File): Promise<ArrayBuffer> {
  const header = file.slice(0, 256);
  if (typeof header.arrayBuffer === 'function') return header.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result === null || typeof reader.result === 'string') reject(new Error('Cannot read image header.'));
      else resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(header);
  });
}

/** A signature check is an early client-side rejection, not an image decoder or a server trust boundary. */
async function matchesRasterSignature(file: File): Promise<boolean> {
  try {
    const bytes = new Uint8Array(await readImageHeader(file));
    switch (file.type) {
      case 'image/png':
        return bytes[0] === 0x89 && matchesAscii(bytes, 1, 'PNG\r\n\x1a\n') && matchesAscii(bytes, 12, 'IHDR');
      case 'image/jpeg':
        return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      case 'image/gif':
        return bytes.length >= 13 && (matchesAscii(bytes, 0, 'GIF87a') || matchesAscii(bytes, 0, 'GIF89a'));
      case 'image/webp':
        return matchesAscii(bytes, 0, 'RIFF') && matchesAscii(bytes, 8, 'WEBP') &&
          (matchesAscii(bytes, 12, 'VP8 ') || matchesAscii(bytes, 12, 'VP8L') || matchesAscii(bytes, 12, 'VP8X'));
      case 'image/avif': {
        if (bytes.length < 16 || !matchesAscii(bytes, 4, 'ftyp')) return false;
        const size = new DataView(bytes.buffer).getUint32(0);
        if (size < 16 || size > file.size) return false;
        const isAvifBrand = (offset: number) =>
          matchesAscii(bytes, offset, 'avif') || matchesAscii(bytes, offset, 'avis');
        if (isAvifBrand(8)) return true;
        for (let offset = 16; offset + 4 <= Math.min(size, bytes.length); offset += 4) {
          if (isAvifBrand(offset)) return true;
        }
        return false;
      }
      case 'image/bmp':
        return bytes.length >= 14 && matchesAscii(bytes, 0, 'BM');
      case 'image/x-icon':
      case 'image/vnd.microsoft.icon':
        return bytes.length >= 6 && bytes[0] === 0 && bytes[1] === 0 &&
          bytes[2] === 1 && bytes[3] === 0 && (bytes[4] !== 0 || bytes[5] !== 0);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export function reportImageUploadError(options: ImageUploadOptions, error: unknown, source: string) {
  const normalizedError = toError(error);
  if (options.onUploadError) {
    options.onUploadError(normalizedError);
    return;
  }
  options.onError?.(normalizedError, { source, recoverable: true });
}

export async function getImageValidationError(file: File, options: ImageUploadOptions): Promise<Error | null> {
  if (options.allowedMimeTypes && !options.allowedMimeTypes.includes(file.type)) {
    return new Error(`File type ${file.type} is not allowed.`);
  }
  if (options.maxFileSize && file.size > options.maxFileSize) {
    return new Error('File size exceeds maximum allowed size.');
  }
  if (!(await matchesRasterSignature(file))) return new Error('File content is not a supported image.');
  return null;
}

/** Shared URL resolution and result validation for inserted and edited images. */
export async function uploadImageFile(
  file: File,
  options: ImageUploadOptions,
  context?: ImageUploadContext,
  fallbackAlt?: string,
): Promise<Partial<ImageNodeAttributes>> {
  let attrs: Partial<ImageNodeAttributes>;
  if (options.onUpload) {
    attrs = toImageNodeAttributes(await options.onUpload(file, context), fallbackAlt);
  } else {
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Failed to read file'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
    attrs = { src, alt: fallbackAlt };
  }
  if (!attrs.src || !isSafeUrl(attrs.src)) throw new Error('Invalid upload result.');
  if (options.resolveFileUrl) {
    const resolved = await options.resolveFileUrl(attrs.src);
    if (typeof resolved !== 'string' || !isSafeUrl(resolved)) {
      throw new Error('Invalid resolved file URL.');
    }
    attrs.src = resolved;
  }
  return attrs;
}
