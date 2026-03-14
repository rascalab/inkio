import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    chain: vi.fn(() => chain),
    state: {
      doc: {
        nodeAt: vi.fn(() => null),
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
  it('uses the optional command helper for block transforms', async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByRole('menuitem', { name: /heading 1/i }));

    expect(chain.focus).toHaveBeenCalledTimes(1);
    expect(chain.setTextSelection).toHaveBeenCalledWith(6);
    expect(chain.setHeading).toHaveBeenCalledWith({ level: 1 });
    expect(chain.run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
