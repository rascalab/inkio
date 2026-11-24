import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { read } from '../index';

function deepDoc(depth: number): JSONContent {
  let node: JSONContent = { type: 'text', text: 'deep' };
  for (let i = 0; i < depth; i++) {
    node = { type: 'doc', content: [node] };
  }
  return node;
}

describe('serialization depth guard', () => {
  it('terminates on adversarially nested input instead of overflowing', () => {
    const saved = read(deepDoc(100_000));
    expect(saved.text).toBe('deep');
    expect(saved.stats).toEqual({ words: 1, chars: 4, blocks: 0 });
  });

  it('skips ancestor back-edges, but includes repeated siblings at each position', () => {
    const paragraph = { type: 'paragraph', content: [{ type: 'text', text: 'twice' }] };
    const doc: JSONContent = { type: 'doc', content: [] };
    doc.content!.push(paragraph, doc, paragraph);
    expect(read(doc).text).toBe('twice\ntwice');
    expect(read(doc).stats.blocks).toBe(2);
  });

  it('keeps shallow documents fully intact', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
    };
    expect(read(doc).text).toBe('hi');
  });
});

describe('saved document cache', () => {
  it('does no traversal until read and reuses text across summary lengths', () => {
    let traversals = 0;
    let markReads = 0;
    const paragraph = { type: 'paragraph', content: [{
      type: 'text', text: 'hello world',
      get marks() {
        markReads++;
        return [{ type: 'comment', attrs: { commentId: 'one' } }];
      },
    }] };
    const saved = read({
      type: 'doc',
      get content() {
        traversals++;
        return [paragraph];
      },
    });

    expect(traversals).toBe(0);
    expect(saved.text).toBe('hello world');
    const firstRead = traversals;
    expect(firstRead).toBeGreaterThan(0);
    expect(saved.summary(5)).toBe('he...');
    expect(saved.summary()).toBe(saved.text);
    expect(traversals).toBe(firstRead);
    expect(markReads).toBe(0);

    expect(saved.commentIds).toEqual(['one']);
    const firstMarkRead = markReads;
    expect(firstMarkRead).toBeGreaterThan(0);
    expect(saved.commentIds).toEqual(['one']);
    expect(markReads).toBe(firstMarkRead);
  });

  it('returns immutable collections and stats from the same reader', () => {
    const saved = read({ type: 'doc', content: [{
      type: 'heading', content: [{ type: 'mention', attrs: { id: '1', label: 'Ada' } }],
    }] });
    for (const key of ['stats', 'mentions', 'hashTags', 'headings', 'commentIds'] as const) {
      const value = saved[key];
      expect(saved[key]).toBe(value);
      expect(Object.isFrozen(value)).toBe(true);
    }
    expect(saved.mentions[0]?.label).toBe('Ada');
    expect(Object.isFrozen(saved.mentions[0])).toBe(true);
    expect(saved.headings[0]?.text).toBe('@Ada');
    expect(Object.isFrozen(saved.headings[0])).toBe(true);
  });

  it('uses a fresh cache when another reader is created after changing the input', () => {
    const text = { type: 'text', text: 'first' };
    const json = { type: 'doc', content: [{ type: 'paragraph', content: [text] }] };
    expect(read(json).text).toBe('first');
    text.text = 'next';
    expect(read(json).text).toBe('next');
  });
});

describe('serialization block coverage', () => {
  it('separates table cells and counts table blocks', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] },
              ],
            },
          ],
        },
      ],
    };
    const saved = read(doc);
    const { text } = saved;
    expect(text).toContain('a');
    expect(text).toContain('b');
    expect(text.replace(/\s+/g, ' ').trim()).not.toBe('ab');
    expect(saved.stats.blocks).toBe(6);
  });

  it('includes visible bookmark and image attributes, separates details, and counts every nested block', () => {
    const saved = read({ type: 'doc', content: [
      { type: 'bookmark', attrs: { title: 'Release', url: 'https://example.com', description: 'What changed' } },
      { type: 'bookmark', attrs: { url: 'https://example.com/plain' } },
      { type: 'imageBlock', attrs: { caption: '  ', alt: 'A diagram' } },
      { type: 'details', content: [
        { type: 'detailsSummary', content: [{ type: 'text', text: 'Title' }] },
        { type: 'detailsContent', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }] },
      ] },
      { type: 'tocBlock' },
    ] });
    expect(saved.text).toBe('Release\nWhat changed\nhttps://example.com/plain\n[Image: A diagram]\nTitle\nBody');
    expect(saved.stats).toEqual({ words: 9, chars: saved.text.length, blocks: 8 });
    expect(saved.summary()).toBe(saved.text);
  });

  it('preserves literal whitespace at code boundaries and within code blocks', () => {
    const code = '  indented  \n\n\n\tlast \n';
    const block = { type: 'codeBlock', content: [{ type: 'text', text: code }] };
    expect(read({ type: 'doc', content: [block] }).text).toBe(code);
    const paragraph = { type: 'paragraph', content: [{ type: 'text', text: 'prose' }] };
    expect(read({ type: 'doc', content: [paragraph, block, paragraph] }).text)
      .toBe(`prose\n${code}\nprose`);
  });
});
