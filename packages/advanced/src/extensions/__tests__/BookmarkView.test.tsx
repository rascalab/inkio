// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { Editor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Bookmark, type BookmarkOptions } from '../Bookmark';

function mountBookmark(resolve: BookmarkOptions['onResolveBookmark'], editable = true) {
  const editor = new Editor({
    editable,
    extensions: [Document, Paragraph, Text, Bookmark.configure({ onResolveBookmark: resolve })],
    content: '<p></p>',
  });
  const rendered = render(<EditorContent editor={editor} />);
  return {
    editor,
    ...rendered,
    destroy() {
      rendered.unmount();
      editor.destroy();
    },
  };
}

describe('BookmarkView preview resolution', () => {
  it('resolves an explicitly inserted bookmark exactly once even for an empty result', async () => {
    const resolve = vi.fn(async () => ({ title: '' }));
    const view = mountBookmark(resolve);
    try {
      await act(async () => { view.editor.commands.setBookmark({ url: 'https://example.com' }); });
      await waitFor(() => expect(resolve).toHaveBeenCalledExactlyOnceWith('https://example.com'));
      expect(view.getByRole('link')).toHaveAttribute('href', 'https://example.com');
    } finally {
      view.destroy();
    }
  });

  it.each([true, false])('does not request previews for loaded documents (editable: %s)', async (editable) => {
    const resolve = vi.fn();
    const view = mountBookmark(resolve, editable);
    try {
      await act(async () => {
        view.editor.commands.setContent('<a data-bookmark-fallback href="https://example.com">Example</a>');
      });
      expect(view.getByRole('link')).toHaveAttribute('href', 'https://example.com');
      expect(resolve).not.toHaveBeenCalled();
    } finally {
      view.destroy();
    }
  });

  it('keeps navigable non-web URLs as links without resolving them', async () => {
    const resolve = vi.fn();
    const view = mountBookmark(resolve);
    try {
      await act(async () => {
        view.editor.commands.setBookmark({ url: 'mailto:person@example.com' });
      });
      expect(view.getByRole('link')).toHaveAttribute('href', 'mailto:person@example.com');
      expect(resolve).not.toHaveBeenCalled();
    } finally {
      view.destroy();
    }
  });

  it('drops malformed preview fields and keeps valid preview text', async () => {
    const resolve = vi.fn(async () => ({ title: 'A web page', description: {}, image: 42 }));
    const view = mountBookmark(resolve as unknown as BookmarkOptions['onResolveBookmark']);
    try {
      await act(async () => { view.editor.commands.setBookmark({ url: 'https://example.com' }); });
      expect(await view.findByText('A web page')).toBeInTheDocument();
      expect(view.queryByRole('img')).toBeNull();
    } finally {
      view.destroy();
    }
  });

  it('does not apply an old preview after a new document is loaded', async () => {
    let finish!: (value: { title: string }) => void;
    const resolve = vi.fn(() => new Promise<{ title: string }>((resolvePreview) => { finish = resolvePreview; }));
    const view = mountBookmark(resolve);
    try {
      await act(async () => { view.editor.commands.setBookmark({ url: 'https://example.com/first' }); });
      await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
      await act(async () => {
        view.editor.commands.setContent('<a data-bookmark-fallback href="https://example.com/second">Second</a>');
        finish({ title: 'First preview' });
      });
      expect(view.getByRole('link')).toHaveAttribute('href', 'https://example.com/second');
      expect(view.queryByText('First preview')).toBeNull();
      expect(resolve).toHaveBeenCalledTimes(1);
    } finally {
      view.destroy();
    }
  });
});
