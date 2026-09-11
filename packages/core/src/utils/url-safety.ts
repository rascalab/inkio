const BLOCKED_PROTOCOLS = new Set(['javascript', 'vbscript', 'file']);
const ALLOWED_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel', 'blob']);

function decodeUrlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_m: string, hex: string) => {
      const code = parseInt(hex, 16);
      return Number.isNaN(code) ? '' : String.fromCharCode(code);
    })
    .replace(/&#(\d+);?/g, (_m: string, dec: string) => {
      const code = parseInt(dec, 10);
      return Number.isNaN(code) ? '' : String.fromCharCode(code);
    })
    .replace(/&(colon|newline|tab|lpar|rpar);?/gi, (m: string) => {
      const lower = m.toLowerCase();
      if (lower.indexOf('&colon') === 0) return ':';
      if (lower.indexOf('&newline') === 0) return '\n';
      if (lower.indexOf('&tab') === 0) return '\t';
      if (lower.indexOf('&lpar') === 0) return '(';
      if (lower.indexOf('&rpar') === 0) return ')';
      return m;
    });
}

const CONTROL_RE = new RegExp(
  '[\\u0000-\\u0020\\u007F\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF\\u200B-\\u200F\\u061C\\u180E\\u00AD]+',
  'g',
);

/**
 * Raster image MIMEs that are safe to embed as `data:` URLs.
 * Notably excludes `image/svg+xml` (executable script content) and any
 * `text/*` / `application/*` payloads.
 */
const SAFE_DATA_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

function normalizeForProtocolCheck(url: string): string {
  const decoded = decodeUrlEntities(url.trim());
  return decoded.replace(CONTROL_RE, '');
}

function getProtocol(normalized: string): string | null {
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(normalized);
  return match ? match[1].toLowerCase() : null;
}

export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  const normalized = normalizeForProtocolCheck(trimmed);
  const protocol = getProtocol(normalized);

  if (!protocol) return true;

  if (BLOCKED_PROTOCOLS.has(protocol)) return false;

  if (protocol === 'data') {
    // Only allow safe raster image payloads (e.g. data:image/png;base64,...).
    // Active-content data URLs such as image/svg+xml, text/html or
    // application/javascript can execute script and must be rejected.
    const after = normalized.slice(5);
    const mime = after.split(/[;,]/, 1)[0]?.trim().toLowerCase() ?? '';
    return SAFE_DATA_IMAGE_MIMES.has(mime);
  }

  if (ALLOWED_PROTOCOLS.has(protocol)) return true;

  return false;
}

export function sanitizeUrlOrEmpty(url: string | null | undefined): string {
  if (typeof url !== 'string') return '';
  if (!isSafeUrl(url)) return '';
  // Return the normalized form (control/invisible chars stripped, entities
  // decoded, trimmed) so obfuscated payloads can't slip through downstream
  // consumers that re-parse the raw string.
  return normalizeForProtocolCheck(url.trim());
}
