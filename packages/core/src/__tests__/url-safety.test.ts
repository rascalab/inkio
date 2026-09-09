import { describe, it, expect } from 'vitest';
import { isSafeUrl } from '../utils/url-safety';

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
});
