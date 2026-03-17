import { fireEvent, render, waitFor } from '@testing-library/react';
import { TableMenu } from '../TableMenu';

function createMockEditor() {
  const addRowAfter = vi.fn(() => ({ run: () => true }));
  const addColumnBefore = vi.fn(() => ({ run: () => true }));
  const deleteTable = vi.fn(() => ({ run: () => true }));

  const editor = {
    isEditable: true,
    isFocused: true,
    state: {
      selection: { from: 2 },
    },
    view: {
      nodeDOM: vi.fn(() => null),
      domAtPos: vi.fn(() => ({
        node: {
          parentElement: {
            closest: () => ({
              getBoundingClientRect: () => ({
                top: 120,
                left: 80,
                right: 420,
                bottom: 280,
                width: 340,
                height: 160,
              }),
            }),
          },
        },
      })),
      dom: {
        contains: () => false,
        getBoundingClientRect: () => ({
          top: 0,
          left: 0,
          right: 640,
          bottom: 480,
          width: 640,
          height: 480,
        }),
      },
    },
    extensionManager: {
      extensions: [{ name: 'table' }],
    },
    isActive: vi.fn((name: string) => name === 'table'),
    can: vi.fn(() => ({
      addColumnBefore: () => true,
      addColumnAfter: () => true,
      deleteColumn: () => true,
      addRowBefore: () => true,
      addRowAfter: () => true,
      deleteRow: () => true,
      toggleHeaderColumn: () => true,
      toggleHeaderRow: () => true,
      mergeCells: () => true,
      splitCell: () => true,
      deleteTable: () => true,
    })),
    chain: vi.fn(() => ({
      focus: () => ({
        addColumnBefore,
        addColumnAfter: vi.fn(() => ({ run: () => true })),
        deleteColumn: vi.fn(() => ({ run: () => true })),
        addRowBefore: vi.fn(() => ({ run: () => true })),
        addRowAfter,
        deleteRow: vi.fn(() => ({ run: () => true })),
        toggleHeaderColumn: vi.fn(() => ({ run: () => true })),
        toggleHeaderRow: vi.fn(() => ({ run: () => true })),
        mergeCells: vi.fn(() => ({ run: () => true })),
        splitCell: vi.fn(() => ({ run: () => true })),
        deleteTable,
        run: () => true,
      }),
    })),
    on: vi.fn(),
    off: vi.fn(),
  } as any;

  return {
    editor,
    addColumnBefore,
    addRowAfter,
    deleteTable,
  };
}

describe('TableMenu component', () => {
  it('renders a table trigger when the selection is inside a table', async () => {
    const { editor } = createMockEditor();
    const { getByRole } = render(<TableMenu editor={editor} />);

    await waitFor(() => {
      expect(getByRole('button', { name: 'Table' })).toBeInTheDocument();
    });
  });

  it('runs table actions through tiptap commands', async () => {
    const { editor, addRowAfter } = createMockEditor();
    const { getByRole } = render(<TableMenu editor={editor} />);

    const trigger = await waitFor(() => getByRole('button', { name: 'Table' }));
    fireEvent.click(trigger);

    const action = getByRole('button', { name: 'Add row below' });
    fireEvent.mouseDown(action);

    expect(addRowAfter).toHaveBeenCalledTimes(1);
  });

  it('disables destructive actions when can() returns false', async () => {
    const { editor } = createMockEditor();
    editor.can = vi.fn(() => ({
      addColumnBefore: () => true,
      addColumnAfter: () => true,
      deleteColumn: () => true,
      addRowBefore: () => true,
      addRowAfter: () => true,
      deleteRow: () => true,
      toggleHeaderColumn: () => true,
      toggleHeaderRow: () => true,
      mergeCells: () => true,
      splitCell: () => true,
      deleteTable: () => false,
    }));

    const { getByRole } = render(<TableMenu editor={editor} />);

    const trigger = await waitFor(() => getByRole('button', { name: 'Table' }));
    fireEvent.click(trigger);

    expect(getByRole('button', { name: 'Delete table' })).toBeDisabled();
  });
});
