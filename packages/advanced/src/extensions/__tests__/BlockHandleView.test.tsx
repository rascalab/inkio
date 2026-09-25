import { fireEvent, render, screen } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { BlockHandleActionMenu } from '../BlockHandle';

function createMockEditor() {
  const chain = {
    focus: vi.fn(() => chain),
    setTextSelection: vi.fn(() => chain),
    setHeading: vi.fn(() => chain),
    run: vi.fn(() => true),
  };

  const editor = {
    // The menu renders only for editable editors (read-only gating is
    // covered by blockhandle-readonly.test.tsx); this suite tests actions.
    isEditable: true,
    chain: vi.fn(() => chain),
    state: {
      doc: {
        content: { size: 10 },
        nodeAt: vi.fn(() => ({
          isAtom: false,
          isLeaf: false,
          isText: false,
          isInline: false,
          type: { name: 'paragraph' },
          nodeSize: 4,
          textContent: 'x',
        })),
      },
      tr: {
        delete: vi.fn(),
        insert: vi.fn(),
      },
    },
    view: {
      dispatch: vi.fn(),
    },
  } as unknown as Editor;

  return { editor, chain };
}

describe('BlockHandleActionMenu', () => {
  it('uses the optional command helper for block transforms', () => {
    const onClose = vi.fn();
    const { editor, chain } = createMockEditor();

    render(
      <BlockHandleActionMenu
        editor={editor}
        blockPos={5}
        anchorRect={{ top: 20, left: 20, right: 60, bottom: 60, width: 40, height: 40 }}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /heading 1/i }));

    expect(chain.focus).toHaveBeenCalledTimes(1);
    expect(chain.setTextSelection).toHaveBeenCalledWith(6);
    expect(chain.setHeading).toHaveBeenCalledWith({ level: 1 });
    expect(chain.run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
