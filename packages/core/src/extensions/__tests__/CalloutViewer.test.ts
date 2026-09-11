import { waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Callout } from '../Callout';

const CALLOUT_DOC = {
  type: 'doc',
  content: [
    {
      type: 'callout',
      attrs: { color: 'blue', icon: null },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Read me' }] }],
    },
  ],
};

function selectInsideCallout(editor: Editor) {
  // Position 2 lands inside the callout's paragraph.
  editor.chain().setTextSelection(2).run();
}

function mountEditor(options: {
  editable: boolean;
}): { editor: Editor; cleanup: () => void } {
  const element = document.createElement('div');
  // The toolbar mounts into the editor's DOM subtree, so it must be attached.
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [Document, Paragraph, Text, Callout],
    content: CALLOUT_DOC,
    editable: options.editable,
  });
  return {
    editor,
    cleanup: () => {
      editor.destroy();
      element.remove();
    },
  };
}

describe('Callout toolbar in read-only surfaces', () => {
  it('does not show the editing toolbar when the editor is not editable', async () => {
    const { editor, cleanup } = mountEditor({ editable: false });

    selectInsideCallout(editor);
    // Let any async mount settle, then assert absence.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector('.inkio-callout-toolbar')).toBeNull();
    cleanup();
  });

  it('shows the editing toolbar when the editor is editable', async () => {
    const { editor, cleanup } = mountEditor({ editable: true });

    selectInsideCallout(editor);
    // The toolbar root mounts asynchronously.
    await waitFor(() => {
      expect(document.querySelector('.inkio-callout-toolbar')).not.toBeNull();
    });
    cleanup();
  });
});
