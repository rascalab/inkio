import { describe, expect, it } from 'vitest';
import { slugifyHeading, getHeadingsFromContent, getHeadingElements } from '../ToC';
import type { JSONContent } from '@tiptap/core';

describe('slugifyHeading', () => {
  it('converts spaces to hyphens and lowercases', () => {
    const used = new Set<string>();
    expect(slugifyHeading('Hello World', used)).toBe('hello-world');
  });

  it('strips leading non-alphanumeric characters', () => {
    const used = new Set<string>();
    expect(slugifyHeading('---intro', used)).toBe('intro');
  });

  it('strips disallowed characters', () => {
    const used = new Set<string>();
    expect(slugifyHeading('Hello! @World#', used)).toBe('hello-world');
  });

  it('preserves Korean characters', () => {
    const used = new Set<string>();
    expect(slugifyHeading('소개 페이지', used)).toBe('소개-페이지');
  });

  it('deduplicates ids with suffix', () => {
    const used = new Set<string>();
    expect(slugifyHeading('title', used)).toBe('title');
    expect(slugifyHeading('title', used)).toBe('title-1');
    expect(slugifyHeading('title', used)).toBe('title-2');
  });

  it('returns "section" for empty/whitespace-only text', () => {
    const used = new Set<string>();
    expect(slugifyHeading('', used)).toBe('section');
    expect(slugifyHeading('   ', used)).toBe('section-1');
  });

  it('returns "section" for text that becomes empty after stripping', () => {
    const used = new Set<string>();
    expect(slugifyHeading('!!!', used)).toBe('section');
  });
});

describe('getHeadingsFromContent', () => {
  it('returns empty array for null/undefined content', () => {
    expect(getHeadingsFromContent(null)).toEqual([]);
    expect(getHeadingsFromContent(undefined)).toEqual([]);
  });

  it('returns empty array for content with no headings', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      ],
    };
    expect(getHeadingsFromContent(doc)).toEqual([]);
  });

  it('extracts headings with correct level, text, index, and id', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Introduction' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Some text' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Details' }] },
      ],
    };
    const headings = getHeadingsFromContent(doc);
    expect(headings).toHaveLength(2);
    expect(headings[0]).toEqual({ level: 1, text: 'Introduction', index: 0, id: 'introduction' });
    expect(headings[1]).toEqual({ level: 2, text: 'Details', index: 1, id: 'details' });
  });

  it('joins text from nested inline nodes', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'World', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    const headings = getHeadingsFromContent(doc);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('Hello World');
  });

  it('generates unique ids for duplicate heading text', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
      ],
    };
    const headings = getHeadingsFromContent(doc);
    expect(headings.map((h) => h.id)).toEqual(['section', 'section-1', 'section-2']);
  });

  it('clamps heading level to 1-6', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 0 }, content: [{ type: 'text', text: 'Too low' }] },
        { type: 'heading', attrs: { level: 9 }, content: [{ type: 'text', text: 'Too high' }] },
      ],
    };
    const headings = getHeadingsFromContent(doc);
    expect(headings[0].level).toBe(1);
    expect(headings[1].level).toBe(6);
  });

  it('handles empty headings with fallback id', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [] },
      ],
    };
    const headings = getHeadingsFromContent(doc);
    expect(headings[0].text).toBe('');
    expect(headings[0].id).toBe('section-1');
  });
});

describe('getHeadingElements', () => {
  it('returns empty array when editor is null', () => {
    expect(getHeadingElements(null)).toEqual([]);
    expect(getHeadingElements(undefined)).toEqual([]);
  });

  it('returns empty array when view.dom is missing', () => {
    expect(getHeadingElements({ view: undefined })).toEqual([]);
    expect(getHeadingElements({ view: { dom: undefined } })).toEqual([]);
  });

  it('finds heading elements in DOM container', () => {
    const container = document.createElement('div');
    container.innerHTML = '<h1>Title</h1><p>text</p><h2>Sub</h2><h3>Sub-sub</h3>';
    const editor = { view: { dom: container } };

    const els = getHeadingElements(editor);
    expect(els).toHaveLength(3);
    expect(els[0].tagName).toBe('H1');
    expect(els[1].tagName).toBe('H2');
    expect(els[2].tagName).toBe('H3');
  });

  it('filters by maxLevel', () => {
    const container = document.createElement('div');
    container.innerHTML = '<h1>A</h1><h2>B</h2><h3>C</h3><h4>D</h4>';
    const editor = { view: { dom: container } };

    const els = getHeadingElements(editor, 2);
    expect(els).toHaveLength(2);
    expect(els[0].tagName).toBe('H1');
    expect(els[1].tagName).toBe('H2');
  });
});
