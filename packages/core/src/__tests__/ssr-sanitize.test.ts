import { describe, it, expect } from 'vitest';
import { renderInkioStaticContent } from '../ssr/render-static-content';

// Verifies static/SSR HTML hardening: no active-content data URLs on <img>,
// and reverse-tabnabbing protection (rel="noopener noreferrer") on links
// that open a new browsing context.
describe('renderInkioStaticContent sanitization', () => {
  it('strips data: image sources but keeps http(s) sources', () => {
    const { html } = renderInkioStaticContent(
      '<p><img src="data:image/svg+xml,<svg onload=alert(1)>"></p>',
      [],
    );
    expect(html).not.toContain('data:image/svg+xml');

    const safe = renderInkioStaticContent(
      '<p><img src="https://example.com/a.png" alt="a"></p>',
      [],
    );
    expect(safe.html).toContain('https://example.com/a.png');
  });

  it('enforces rel="noopener noreferrer" on links with a target', () => {
    const { html } = renderInkioStaticContent(
      '<p><a href="https://example.com" target="_blank">x</a></p>',
      [],
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('noopener');
    expect(html).toContain('noreferrer');
  });

  it('drops javascript: hrefs', () => {
    const { html } = renderInkioStaticContent(
      '<p><a href="javascript:alert(1)">x</a></p>',
      [],
    );
    expect(html).not.toContain('javascript:');
  });
});
