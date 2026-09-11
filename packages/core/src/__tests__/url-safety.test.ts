import { describe, it, expect } from 'vitest';
import { isSafeUrl, sanitizeUrlOrEmpty } from '../utils/url-safety';

// Verifies the documented URL-safety guarantee:
// isSafeUrl must reject javascript:/data:/vbscript: (case-insensitive, leading whitespace).
describe('url-safety: isSafeUrl', () => {
  it('rejects dangerous protocols', () => {
    const dangerous = [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'JAVASCRIPT:void(0)',
      'jAvAsCrIpT:alert(1)',
      '   javascript:alert(1)',
      '\t javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'DATA:text/html,x',
      'vbscript:msgbox(1)',
      'VBScript:msgbox(1)',
    ];
    for (const url of dangerous) {
      expect(isSafeUrl(url), url).toBe(false);
    }
  });

  it('rejects obfuscated protocols', () => {
    const obfuscated = [
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      '  java\tscript:alert(1)',
      'javascript&#58;alert(1)',
      'javascript&colon;alert(1)',
      '&#106;avascript:alert(1)',
      'file:///etc/passwd',
      'about:blank',
      'ftp://example.com/file',
    ];
    for (const url of obfuscated) {
      expect(isSafeUrl(url), url).toBe(false);
    }
  });

  it('allows ordinary URLs', () => {
    const safe = [
      'https://example.com',
      'http://example.com/path?q=1',
      'mailto:user@example.com',
      'tel:+123456789',
      '/relative/path',
      './local',
      '#anchor',
      'blob:https://example.com/uuid',
      'data:image/png;base64,iVBORw0KGgo=',
    ];
    for (const url of safe) {
      expect(isSafeUrl(url), url).toBe(true);
    }
  });

  it('treats empty / nullish input as unsafe', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
  });

  it('rejects active-content data URLs while allowing safe raster MIMEs', () => {
    const dangerous = [
      'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+',
      'data:image/svg+xml,<svg onload="alert(1)">',
      'DATA:IMAGE/SVG+XML,<svg></svg>',
      'data:text/html,<script>alert(1)</script>',
      'data:text/html;base64,PGI+MQ==',
      'data:application/javascript,alert(1)',
      'data:,alert(1)',
    ];
    for (const url of dangerous) {
      expect(isSafeUrl(url), url).toBe(false);
    }

    const safeRaster = [
      'data:image/png;base64,iVBORw0KGgo=',
      'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      'data:image/gif;base64,R0lGODdhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs=',
      'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA==',
    ];
    for (const url of safeRaster) {
      expect(isSafeUrl(url), url).toBe(true);
    }
  });

  it('normalizes invisible characters before the protocol check', () => {
    const obfuscated = [
      'java\u200Bscript:alert(1)',
      'java\u200Cscript:alert(1)',
      'java\u200Dscript:alert(1)',
      'java\uFEFFscript:alert(1)',
      'java\u00A0script:alert(1)',
      '\u200Bjavascript:alert(1)',
      'java\u200Escript:alert(1)',
    ];
    for (const url of obfuscated) {
      expect(isSafeUrl(url), JSON.stringify(url)).toBe(false);
    }
  });

  it('sanitizeUrlOrEmpty returns the normalized string, not the raw input', () => {
    expect(sanitizeUrlOrEmpty('https://example.com/a')).toBe('https://example.com/a');
    // Invisible chars must be stripped in the returned value.
    expect(sanitizeUrlOrEmpty('java\u200Bscript:alert(1)')).toBe('');
    expect(sanitizeUrlOrEmpty('https://example.com/\u200B')).toBe('https://example.com/');
    // Unsafe input yields empty string.
    expect(sanitizeUrlOrEmpty('javascript:alert(1)')).toBe('');
    expect(sanitizeUrlOrEmpty(null)).toBe('');
  });
});
