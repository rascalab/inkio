import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Bookmark } from '../extensions/Bookmark';

function createEditor(htmlAttributes: Record<string, unknown> = {}) {
  return new Editor({
    element: document.createElement('div'),
    extensions: [
      Document,
      Paragraph,
      Text,
      Bookmark.configure({ HTMLAttributes: htmlAttributes as Record<string, never> }),
    ],
    content: {
      type: 'doc',
      content: [{ type: 'bookmark', attrs: { url: 'https://example.com/note' } }],
    },
  });
}

/**
 * Fallback bookmark links point at user-supplied URLs: rel/target are
 * security attributes and must survive HTMLAttributes overrides.
 */
describe('Bookmark fallback link hardening', () => {
  it('emits noopener/nofollow + _blank by default', () => {
    const editor = createEditor();
    const html = editor.getHTML();
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
    editor.destroy();
  });

  it('pins rel/target even when HTMLAttributes tries to downgrade them', () => {
    const editor = createEditor({ rel: 'opener', target: '_self' });
    const html = editor.getHTML();
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain('rel="opener"');
    expect(html).not.toContain('target="_self"');
    editor.destroy();
  });
});
