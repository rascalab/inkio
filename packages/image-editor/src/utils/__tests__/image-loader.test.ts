// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadImage } from '../image-loader';

afterEach(() => {
  vi.useRealTimers();
});

describe('loadImage', () => {
  it('rejects blocked URL schemes instead of assigning them', async () => {
    await expect(loadImage('javascript:alert(1)')).rejects.toThrow(/blocked URL scheme/);
  });

  it.each([
    'data:image/svg+xml,<svg onload="alert(1)"></svg>',
    'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'mailto:someone@example.com',
    'tel:+100',
    'java&#x73;cript:alert(1)',
  ])('rejects %s like core isSafeUrl', async (src) => {
    await expect(loadImage(src)).rejects.toThrow(/blocked URL scheme/);
  });

  it.each([
    'https://x.test/a.png',
    'http://x.test/a.png',
    '/uploads/a.png',
    'images/a.png',
    'blob:http://localhost/0d7c4c0e-1a2b-4c3d-9e8f-001122334455',
    'data:image/png;base64,iVBORw0KGgo=',
    'data:image/jpeg;base64,/9j/4AAQ',
    'data:image/webp;base64,UklGRg==',
  ])('accepts %s (loading starts instead of a blocked-scheme rejection)', async (src) => {
    vi.useFakeTimers();
    const pending = loadImage(src);
    const assertion = expect(pending).rejects.toThrow(/Timed out/);
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;
  });

  it('shares one fetch between concurrent loads of the same src', async () => {
    vi.useFakeTimers();
    const first = loadImage('http://x.test/shared.png');
    const second = loadImage('http://x.test/shared.png');
    expect(second).toBe(first);
    const assertion = expect(first).rejects.toThrow(/Timed out/);
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;
  });
});
