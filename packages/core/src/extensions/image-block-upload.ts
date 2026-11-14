import { toError, type InkioErrorHandler } from '../errors';
import { isSafeUrl } from '../utils/url-safety';

type ImageUploadResult = string | Record<string, unknown>;

/** `blockId` identifies the transient placeholder of a newly inserted image. */
export interface ImageUploadContext {
  blockId?: string;
}

export interface ImageUploadOptions {
  /** Handles new uploads and edited image files; returns the uploaded URL or image attributes. */
  onUpload?: (file: File, context?: ImageUploadContext) => Promise<ImageUploadResult>;
  resolveFileUrl?: (url: string) => Promise<string>;
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

const EXECUTABLE_PREFIXES = [
  '<!doctype', '<html', '<head', '<body', '<script', '<svg', '<?xml', '<!',
  '%pdf', 'mz',
] as const;

/** Best-effort sniffing; the MIME allowlist remains authoritative when bytes cannot be read. */
async function sniffImageContent(file: File): Promise<boolean> {
  try {
    const slice = typeof file.slice === 'function' ? file.slice(0, 64) : file;
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes.length === 0) return true;
    const head = Array.from(bytes.slice(0, 64))
      .map((b) => String.fromCharCode(b))
      .join('')
      .replace(/^[\0\x01-\x08\x0B\x0C\x0E-\x1F\x7F\s]+/, '')
      .toLowerCase();
    if (!head) return true;
    return !EXECUTABLE_PREFIXES.some((prefix) => head.startsWith(prefix));
  } catch {
    return true;
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
  if (!(await sniffImageContent(file))) return new Error('File content is not a supported image.');
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
