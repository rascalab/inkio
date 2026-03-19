const BLOCKED_PROTOCOLS = /^(javascript|data|vbscript):/i;

export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return !BLOCKED_PROTOCOLS.test(url.trim());
}
