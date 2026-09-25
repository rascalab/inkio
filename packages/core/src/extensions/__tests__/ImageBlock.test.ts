import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { generateHTML } from '@tiptap/html';
import { getExtensions } from '../get-extensions';
import { ImageBlock, UPLOAD_PLACEHOLDER_PREFIX } from '../ImageBlock';

/**
 * `generateHTML` (used by static/SSR rendering and the Viewer) runs each node's
 * `renderHTML`. A transient upload-placeholder `src` is a sentinel string, not a
 * URL — if it reaches an `<img src>` the browser fetches a bogus relative path.
 */
describe('ImageBlock renderHTML', () => {
  const extensions = getExtensions({});

  const docWith = (attrs: Record<string, unknown>) => ({
    type: 'doc',
    content: [{ type: 'imageBlock', attrs }],
  });

  it('renders a real image src as an <img>', () => {
    const html = generateHTML(docWith({ src: 'https://example.com/a.png', alt: 'a' }), extensions);
    expect(html).toContain('<img');
    expect(html).toContain('https://example.com/a.png');
  });

  it('does not emit a fetchable <img src> for an upload placeholder', () => {
    const placeholderSrc = `${UPLOAD_PLACEHOLDER_PREFIX}1779420132512_gqxma3ln5ba`;
    const html = generateHTML(docWith({ src: placeholderSrc, alt: 'photo.png' }), extensions);

    // The sentinel must never reach the rendered HTML — that triggers a bogus fetch.
    expect(html).not.toContain(UPLOAD_PLACEHOLDER_PREFIX);
    // Instead it renders a loading box.
    expect(html).toContain('inkio-image-block-placeholder');
  });
});

describe('setImageBlockWidth bounds', () => {
  function createWidthEditor() {
    return new Editor({
      element: document.createElement('div'),
      extensions: [Document, Paragraph, Text, ImageBlock],
      content: {
        type: 'doc',
        content: [{ type: 'imageBlock', attrs: { src: 'https://example.com/a.png' } }],
      },
    });
  }

  function widthOf(editor: Editor): unknown {
    const content = editor.getJSON().content as Array<{ attrs?: Record<string, unknown> }>;
    return content[0]?.attrs?.width;
  }

  it('rejects non-finite widths instead of persisting NaN', () => {
    const editor = createWidthEditor();
    expect(editor.commands.setImageBlockWidth(Number.NaN)).toBe(false);
    expect(editor.commands.setImageBlockWidth(Number.POSITIVE_INFINITY)).toBe(false);
    expect(widthOf(editor)).toBe('100%');
    editor.destroy();
  });

  it('clamps finite out-of-range widths into the resize-handle range', () => {
    const editor = createWidthEditor();
    expect(editor.commands.setImageBlockWidth(5000)).toBe(true);
    expect(widthOf(editor)).toBe('100%');
    expect(editor.commands.setImageBlockWidth(-3)).toBe(true);
    expect(widthOf(editor)).toBe('10%');
    editor.destroy();
  });
});
