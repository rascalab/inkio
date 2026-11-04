import { getSchema } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it, vi } from 'vitest';
import { dropUnknownContent } from '../drop-unknown-content';

const schema = getSchema([Document, Paragraph, Text]);
const text = (value: string, marks?: { type: string }[]) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });

describe('dropUnknownContent', () => {
  it('returns content that fits unchanged', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [text('글')] }] };
    expect(dropUnknownContent(doc, schema)).toBe(doc);
    expect(dropUnknownContent('<p>글</p>', schema)).toBe('<p>글</p>');
  });

  it('does not throw on a malformed document', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let deep: Record<string, unknown> = { type: 'paragraph' };
    for (let i = 0; i < 200_000; i += 1) deep = { type: 'paragraph', content: [deep] };
    for (const doc of [
      { type: 'paragraph', marks: 'bold', content: 'text' },
      { type: 'paragraph', marks: [null, 7], content: [null, 7] },
      { type: 'gone', content: 'text' },
      deep,
    ]) {
      expect(() => dropUnknownContent(doc as never, schema)).not.toThrow();
    }
    warn.mockRestore();
  });

  it('keeps text under a mark, and what an unknown node holds or is called', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cleaned = dropUnknownContent({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [text('표시', [{ type: 'comment' }]), { type: 'mention', attrs: { label: '민수' } }] },
        { type: 'callout', content: [{ type: 'paragraph', content: [text('안쪽')] }] },
        { type: 'bookmark', attrs: { url: 'https://example.com' } },
        { type: 'divider' },
      ],
    }, schema);

    expect(cleaned).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '표시', marks: [] }, { type: 'text', text: '민수' }] },
        { type: 'paragraph', content: [text('안쪽')] },
        { type: 'paragraph', content: [text('https://example.com')] },
      ],
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('comment, mention, callout, bookmark, divider'));
    warn.mockRestore();
  });
});
