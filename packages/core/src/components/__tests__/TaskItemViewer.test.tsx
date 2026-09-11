import { fireEvent, render, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import { TaskItemView } from '../TaskItemView';

const TASK_DOC = {
  type: 'doc',
  content: [
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Buy milk' }] }],
        },
      ],
    },
  ],
};

function mountTaskEditor(editable: boolean) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [
      Document,
      Paragraph,
      Text,
      TaskList,
      TaskItem.configure({ nested: true }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(TaskItemView);
        },
      }),
    ],
    content: TASK_DOC,
    editable,
  });
  // Node views only render through an EditorContent host.
  const view = render(<EditorContent editor={editor} />);
  return {
    editor,
    cleanup: () => {
      view.unmount();
      editor.destroy();
      element.remove();
    },
  };
}

function isChecked(editor: Editor): unknown {
  let checked: unknown = null;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'taskItem') {
      checked = node.attrs.checked;
      return false;
    }
    return true;
  });
  return checked;
}

describe('TaskItem checkbox in read-only surfaces', () => {
  it('does not toggle when the editor is not editable', async () => {
    const { editor, cleanup } = mountTaskEditor(false);
    // The React node view mounts asynchronously through tiptap portals.
    await waitFor(() => {
      expect(document.querySelector('.inkio-task-checkbox-btn')).not.toBeNull();
    });
    const button = document.querySelector('.inkio-task-checkbox-btn');
    fireEvent.mouseDown(button!);
    expect(isChecked(editor)).toBe(false);
    cleanup();
  });

  it('toggles when the editor is editable', async () => {
    const { editor, cleanup } = mountTaskEditor(true);
    await waitFor(() => {
      expect(document.querySelector('.inkio-task-checkbox-btn')).not.toBeNull();
    });
    const button = document.querySelector('.inkio-task-checkbox-btn');
    fireEvent.mouseDown(button!);
    expect(isChecked(editor)).toBe(true);
    cleanup();
  });
});
