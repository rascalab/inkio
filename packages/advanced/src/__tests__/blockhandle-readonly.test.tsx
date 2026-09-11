import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/core';
import { BlockHandleActionMenu } from '../extensions/BlockHandle/BlockHandleView';

function createMockEditor(editable: boolean) {
  const editor = {
    isEditable: editable,
    state: {
      doc: {
        content: { size: 10 },
        nodeAt: vi.fn(() => ({ nodeSize: 2, isAtom: false, isLeaf: false, type: { name: 'paragraph' } })),
      },
      tr: {
        delete: vi.fn(() => 'TR'),
        insert: vi.fn(() => ({ setSelection: () => ({ scrollIntoView: () => 'TR' }) })),
      },
    },
    view: {
      dispatch: vi.fn(),
    },
  } as unknown as Editor;

  return editor;
}

const baseProps = {
  blockPos: 1,
  anchorRect: { top: 20, left: 20, right: 60, bottom: 60, width: 40, height: 40 },
  onClose: () => undefined,
};

/**
 * The block-handle menu must not render — and no menu action may dispatch —
 * on a read-only editor.
 */
describe('BlockHandleActionMenu read-only gating', () => {
  it('renders nothing when the editor is not editable', () => {
    const { container } = render(
      <BlockHandleActionMenu editor={createMockEditor(false)} {...baseProps} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('dispatches delete when editable', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const editor = createMockEditor(true);

    render(<BlockHandleActionMenu editor={editor} {...baseProps} onClose={onClose} />);

    await user.click(screen.getByRole('menuitem', { name: /delete/i }));

    expect(editor.view.dispatch).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch when read-only even if actions were reachable', async () => {
    const editor = createMockEditor(false);
    render(<BlockHandleActionMenu editor={editor} {...baseProps} />);
    // No menu items exist to click.
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(editor.view.dispatch).not.toHaveBeenCalled();
  });
});
