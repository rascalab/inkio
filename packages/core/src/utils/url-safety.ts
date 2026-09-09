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

const CONTROL_RE = new RegExp('[\\u0000-\\u0020\\u007F]+', 'g');

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
    const after = normalized.slice(5).toLowerCase();
    return after.indexOf('image/') === 0;
  }

  if (ALLOWED_PROTOCOLS.has(protocol)) return true;

  return false;
}

export function sanitizeUrlOrEmpty(url: string | null | undefined): string {
  if (typeof url !== 'string') return '';
  return isSafeUrl(url) ? url : '';
}
