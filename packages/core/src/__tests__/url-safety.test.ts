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

  it('allows ordinary URLs', () => {
    const safe = [
      'https://example.com',
      'http://example.com/path?q=1',
      'mailto:user@example.com',
      'tel:+123456789',
      '/relative/path',
      './local',
      '#anchor',
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
