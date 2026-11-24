import { createElement } from 'react';
import { render, waitFor } from '@testing-library/react';
import { Editor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { CodeBlock } from '../CodeBlock';

const engineImported = vi.hoisted(() => vi.fn());
vi.mock(import('lowlight'), async (importOriginal) => {
  engineImported();
  return importOriginal();
});

it('keeps prose editors cold and paints the current read-only document when the shared engine arrives', async () => {
  const extensions = [Document, Paragraph, Text, CodeBlock];
  const editor = new Editor({ extensions, content: '<p>const old = 1;</p>' });
  const viewer = new Editor({ extensions, content: '<p>Intro</p>', editable: false });
  const { unmount } = render(createElement(EditorContent, { editor: viewer }));
  try {
    await waitFor(() => expect(editor.isInitialized && viewer.isInitialized).toBe(true));
    editor.commands.insertContent('x');
    await vi.dynamicImportSettled();
    expect(engineImported).not.toHaveBeenCalled();

    // The editor that first requested the engine can disappear in the same turn.
    expect(editor.commands.setCodeBlock({ language: 'python' })).toBe(true);
    editor.destroy();
    const replaceCode = (source: string) => viewer.commands.setContent({
      type: 'doc', content: [{
        type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: source }],
      }],
    }, { emitUpdate: false });
    replaceCode('const stale = 1;');
    replaceCode('let current = 2;');

    await waitFor(() => expect(viewer.view.dom.querySelector('.hljs-keyword')?.textContent).toBe('let'));
    expect(viewer.view.dom.querySelector('pre code')?.textContent).toBe('let current = 2;');
    expect(engineImported).toHaveBeenCalledTimes(1);
  } finally {
    unmount();
    if (!editor.isDestroyed) editor.destroy();
    viewer.destroy();
  }
});
