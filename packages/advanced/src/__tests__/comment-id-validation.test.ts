import { describe, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Comment } from '../comment/Comment';

function createEditor() {
  return new Editor({
    element: document.createElement('div'),
    editable: true,
    extensions: [
      Document,
      Paragraph,
      Text,
      Comment.configure({ getThread: () => null }),
    ],
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'hello',
              marks: [{ type: 'comment', attrs: { commentId: 't1' } }],
            },
          ],
        },
      ],
    },
  });
}

/**
 * Comment ids arrive from host stores and JSON: every command normalizes
 * non-string/blank input to a false return instead of throwing on trim.
 */
describe('Comment id normalization', () => {
  it.each([null, undefined, 42, '', '   '])(
    'resolveComment returns false for %p without throwing',
    (badId) => {
      const editor = createEditor();
      try {
        expect(() =>
          editor.commands.resolveComment(badId as unknown as string),
        ).not.toThrow();
        expect(editor.commands.resolveComment(badId as unknown as string)).toBe(false);
      } finally {
        editor.destroy();
      }
    },
  );

  it('unresolveComment returns false for non-string ids without throwing', () => {
    const editor = createEditor();
    try {
      expect(editor.commands.unresolveComment(null as unknown as string)).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('setComment returns false when attrs are missing', () => {
    const editor = createEditor();
    try {
      expect(
        editor.commands.setComment(undefined as unknown as { commentId: string }),
      ).toBe(false);
    } finally {
      editor.destroy();
    }
  });

  it('still resolves a valid id', () => {
    const editor = createEditor();
    try {
      expect(editor.commands.resolveComment('t1')).toBe(true);
    } finally {
      editor.destroy();
    }
  });
});
