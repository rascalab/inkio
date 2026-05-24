import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableMenu } from '../TableMenu';

const TABLE_COMMANDS = [
  'addColumnBefore',
  'addColumnAfter',
  'deleteColumn',
  'addRowBefore',
  'addRowAfter',
  'deleteRow',
  'toggleHeaderColumn',
  'toggleHeaderRow',
  'mergeCells',
  'splitCell',
  'deleteTable',
] as const;

/** Builds a mock editor backed by a real (detached) 3×3 table DOM. */
function createMockEditor(
  canOverrides: Partial<Record<string, boolean>> = {},
  { isActiveTable = true }: { isActiveTable?: boolean } = {},
) {
  const dom = document.createElement('div');
  const table = document.createElement('table');
  for (let row = 0; row < 3; row += 1) {
    const tr = table.insertRow();
    for (let col = 0; col < 3; col += 1) {
      tr.appendChild(document.createElement(row === 0 ? 'th' : 'td'));
    }
  }
  dom.appendChild(table);

  const commandSpies = Object.fromEntries(TABLE_COMMANDS.map((name) => [name, vi.fn()]));
  const makeChain = () => {
    const chain: Record<string, unknown> = {
      focus: () => chain,
      setTextSelection: () => chain,
      run: () => true,
    };
    for (const name of TABLE_COMMANDS) {
      chain[name] = (...args: unknown[]) => {
        commandSpies[name](...args);
        return chain;
      };
    }
    return chain;
  };

  const editor = {
    isEditable: true,
    isFocused: true,
    state: { selection: { from: 2 } },
    view: {
      dom,
      nodeDOM: vi.fn(() => null),
      domAtPos: vi.fn(() => ({ node: table.rows[1].cells[0] })),
      posAtDOM: vi.fn(() => 5),
    },
    extensionManager: { extensions: [{ name: 'table' }] },
    isActive: vi.fn((name: string) => isActiveTable && name === 'table'),
    can: vi.fn(() =>
      Object.fromEntries(TABLE_COMMANDS.map((name) => [name, () => canOverrides[name] ?? true])),
    ),
    chain: vi.fn(makeChain),
    on: vi.fn(),
    off: vi.fn(),
  } as any;

  return { editor, table, commandSpies };
}

describe('TableMenu', () => {
  it('renders a boundary insert button for every row and column edge', async () => {
    const { editor } = createMockEditor();
    const { getAllByRole } = render(<TableMenu editor={editor} />);

    await waitFor(() => {
      // 3 columns and 3 rows each yield 4 boundaries.
      expect(getAllByRole('button', { name: /Add column/ })).toHaveLength(4);
      expect(getAllByRole('button', { name: /Add row/ })).toHaveLength(4);
    });
  });

  it('inserts a column at the clicked boundary', async () => {
    const { editor, commandSpies } = createMockEditor();
    const { getAllByRole } = render(<TableMenu editor={editor} />);

    const columnButtons = await waitFor(() => getAllByRole('button', { name: /Add column/ }));
    fireEvent.mouseDown(columnButtons[0]);

    expect(commandSpies.addColumnBefore).toHaveBeenCalledTimes(1);
  });

  it('opens a context menu on right-click and runs the chosen action', async () => {
    const { editor, table, commandSpies } = createMockEditor();
    const { getByRole } = render(<TableMenu editor={editor} />);

    fireEvent.contextMenu(table.rows[1].cells[1], { clientX: 40, clientY: 40 });

    const menu = await waitFor(() => getByRole('menu'));
    expect(menu).toBeInTheDocument();

    fireEvent.mouseDown(getByRole('menuitem', { name: 'Delete row' }));
    expect(commandSpies.deleteRow).toHaveBeenCalledTimes(1);
  });

  it('reveals controls on table hover even when the selection is not inside', async () => {
    const { editor, table } = createMockEditor({}, { isActiveTable: false });
    const { getAllByRole, queryAllByRole } = render(<TableMenu editor={editor} />);

    // Nothing visible until the mouse enters the table.
    expect(queryAllByRole('button', { name: /Add column/ })).toHaveLength(0);

    fireEvent.mouseOver(table.rows[1].cells[1]);

    await waitFor(() => {
      expect(getAllByRole('button', { name: /Add column/ })).toHaveLength(4);
      expect(getAllByRole('button', { name: /Add row/ })).toHaveLength(4);
    });
  });

  it('disables a context-menu action when the command is unavailable', async () => {
    const { editor, table } = createMockEditor({ deleteTable: false });
    const { getByRole } = render(<TableMenu editor={editor} />);

    fireEvent.contextMenu(table.rows[1].cells[1], { clientX: 40, clientY: 40 });

    await waitFor(() => getByRole('menu'));
    expect(getByRole('menuitem', { name: 'Delete table' })).toBeDisabled();
  });
});
