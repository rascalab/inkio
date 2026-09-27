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

describe('Bookmark URL sanitization keeps ordinary URLs intact', () => {
  const ORDINARY = [
    'https://example.com/note',
    'https://example.com/a/b?x=1&y=two#frag',
    'http://sub.example.co.kr:8080/path_with-dash/%EA%B0%80?q=a%20b',
    'mailto:someone@example.com',
  ];

  function bookmarkAttrs(editor: Editor) {
    let attrs: Record<string, unknown> | null = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'bookmark') attrs = { ...node.attrs };
    });
    return attrs as Record<string, unknown> | null;
  }

  it.each(ORDINARY)('stores %s unchanged via setBookmark, HTML round-trip and preview attrs', (url) => {
    const editor = createEditor();
    editor.commands.setContent('<p></p>');
    expect(editor.commands.setBookmark({ url })).toBe(true);
    expect(bookmarkAttrs(editor)?.url).toBe(url);

    const withPreview = {
      type: 'doc',
      content: [{ type: 'bookmark', attrs: { url, title: 't', image: url, favicon: url } }],
    };
    editor.commands.setContent(withPreview);
    const html = editor.getHTML();
    editor.commands.setContent(html);
    const attrs = bookmarkAttrs(editor);
    expect(attrs?.url).toBe(url);
    expect(attrs?.image).toBe(url);
    expect(attrs?.favicon).toBe(url);
    editor.destroy();
  });

  it('still rejects unsafe URLs', () => {
    const editor = createEditor();
    editor.commands.setContent('<p></p>');
    expect(editor.commands.setBookmark({ url: 'javascript:alert(1)' })).toBe(false);
    expect(editor.commands.setBookmark({ url: 'java&#115;cript:alert(1)' })).toBe(false);
    editor.destroy();
  });
});
