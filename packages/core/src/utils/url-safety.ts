const ALLOWED_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel', 'blob']);
const NAMED_ENTITIES: Record<string, string> = { colon: ':', newline: '\n', tab: '\t', lpar: '(', rpar: ')' };

function decodeUrlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/&(colon|newline|tab|lpar|rpar);?/gi, (_, name: string) => NAMED_ENTITIES[name.toLowerCase()]);
}

const CONTROL_RE = /[\u0000-\u001F\u007F\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF\u200B-\u200F\u061C\u180E\u00AD]+/g;

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
  // A legitimate space encodes to %20 (dropping it would join path
  // segments into a different URL); invisible/control characters still
  // strip, since an encoded zero-width space would render invisibly.
  return decoded.replace(/ /g, '%20').replace(CONTROL_RE, '');
}

/**
 * What someone means by a link they typed. `example.com` stored as is would be a
 * path on the current site. Paths and anything with a scheme stay as they are.
 */
export function normalizeLinkInput(value: string): string {
  const url = value.trim();
  if (/^(?:[a-z][a-z\d+.-]*:\/\/|mailto:|tel:|[/#?.])/i.test(url)) return url;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(url)) return `mailto:${url}`;
  if (/^[^\s/:]+\.[^\s/:.]{2,}(?:[:/?#]\S*)?$/.test(url)) return `https://${url}`;
  return url;
}

export function isSafeUrl(url: string | null | undefined): boolean {
  // Unknown schemes are rejected by the allowlist, including file and script URLs.
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  const normalized = normalizeForProtocolCheck(trimmed);
  const protocol = /^([a-z][a-z\d+.-]*):/i.exec(normalized)?.[1].toLowerCase();

  if (!protocol) return true;

  if (protocol === 'data') {
    // Only allow safe raster image payloads (e.g. data:image/png;base64,...).
    // Active-content data URLs such as image/svg+xml, text/html or
    // application/javascript can execute script and must be rejected.
    const after = normalized.slice(5);
    const mime = after.split(/[;,]/, 1)[0]?.trim().toLowerCase() ?? '';
    return SAFE_DATA_IMAGE_MIMES.has(mime);
  }

  return ALLOWED_PROTOCOLS.has(protocol);
}

export function sanitizeUrlOrEmpty(url: string | null | undefined): string {
  if (typeof url !== 'string') return '';
  if (!isSafeUrl(url)) return '';
  // Return the normalized form (control/invisible chars stripped, entities
  // decoded, trimmed) so obfuscated payloads can't slip through downstream
  // consumers that re-parse the raw string.
  return normalizeForProtocolCheck(url.trim());
}
