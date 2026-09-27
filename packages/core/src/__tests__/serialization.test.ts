import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { getContentStats, toPlainText } from '../serialization';

function deepDoc(depth: number): JSONContent {
  let node: JSONContent = { type: 'text', text: 'deep' };
  for (let i = 0; i < depth; i++) {
    node = { type: 'doc', content: [node] };
  }
  return node;
}

describe('serialization depth guard', () => {
  it('terminates on adversarially nested input instead of overflowing', () => {
    expect(() => toPlainText(deepDoc(100_000))).not.toThrow();
    expect(() => getContentStats(deepDoc(100_000))).not.toThrow();
  });

  it('keeps shallow documents fully intact', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
    };
    expect(toPlainText(doc)).toBe('hi');
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
    const text = toPlainText(doc);
    expect(text).toContain('a');
    expect(text).toContain('b');
    expect(text.replace(/\s+/g, ' ').trim()).not.toBe('ab');
    expect(getContentStats(doc).blocks).toBeGreaterThan(0);
  });
});
