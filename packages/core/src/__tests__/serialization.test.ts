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
    expect(() => saved.text).not.toThrow();
    expect(() => saved.stats).not.toThrow();
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
    expect(saved.stats.blocks).toBeGreaterThan(0);
  });
});
