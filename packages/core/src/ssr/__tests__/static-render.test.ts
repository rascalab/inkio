import { describe, expect, it } from 'vitest';
import { getExtensions } from '../../extensions/get-extensions';
import { renderInkioStaticContent } from '../render-static-content';

const extensions = getExtensions();

describe('static render: never crashes, always sanitizes', () => {
  it('returns an empty shell for invalid documents instead of throwing', () => {
    const bad = { type: 'doc', content: [{ type: 'nope', content: 'x' }] } as never;
    const result = renderInkioStaticContent(bad, extensions);
    expect(typeof result.html).toBe('string');
  });

  it('strips script tags and event handlers from raw HTML input', () => {
    const result = renderInkioStaticContent(
      '<p onclick="evil()">hi</p><script>alert(1)</script>',
      extensions,
    );
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('onclick');
    expect(result.html).toContain('hi');
  });

  it('drops unsafe link targets from generated JSON output', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'click',
          marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
        }],
      }],
    } as never;
    const result = renderInkioStaticContent(doc, extensions);
    expect(result.html).not.toContain('javascript:');
    expect(result.html).toContain('click');
  });

  it('renders unsafe image sources as placeholders, not img tags', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'imageBlock', attrs: { src: 'javascript:alert(1)' } }],
    } as never;
    const result = renderInkioStaticContent(doc, extensions);
    expect(result.html).not.toContain('javascript:');
    expect(result.html).not.toContain('<img');
  });

  it('injects stable heading ids for anchors', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hello World' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Hello World' }] },
      ],
    } as never;
    const result = renderInkioStaticContent(doc, extensions);
    expect(result.html).toContain('id="hello-world"');
    expect(result.html).toContain('id="hello-world-1"');
    expect(result.headings).toHaveLength(2);
  });
});
