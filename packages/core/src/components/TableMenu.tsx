import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { InkioIconId, InkioIconRegistry } from '../icons/registry';
import type {
  InkioCoreMessageOverrides,
  InkioLocaleInput,
  InkioMessageOverrides,
} from '../i18n/messages';
import { useInkioCoreUi } from '../context/use-inkio-ui';
import { autoUpdateOverlayPosition, computeOverlayPosition, fixedOrigin } from '../overlay/positioning';
import { useDismissableLayer } from '../overlay/use-dismissable-layer';
import {
  canExecuteTableAction,
  executeTableAction,
  isTableActive,
  runTableCommandAt,
  type InkioTableActionId,
} from '../table/actions';

export interface TableMenuProps {
  editor: Editor | null;
  className?: string;
  locale?: InkioLocaleInput;
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}

/** Viewport geometry of the active table, used to place the insert affordances. */
type TableMetrics = {
  /** x of every column boundary — length is columnCount + 1. */
  columns: number[];
  /** y of every row boundary — length is rowCount + 1. */
  rows: number[];
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Subtract from the viewport coordinates above when placing a fixed element. */
  origin: { x: number; y: number };
};

type HoverState = { axis: 'column' | 'row'; index: number };
type ContextMenuState = {
  x: number;
  y: number;
  /** The pointer: the menu's size is only known after it renders, and placement restarts from here. */
  anchor: { x: number; y: number };
  origin: { x: number; y: number };
};

// Only what the table offers no other way to do: the + buttons add rows and
// columns, and the block handle menu deletes the table.
const CONTEXT_MENU_CELL_ACTIONS: InkioTableActionId[] = ['mergeCells', 'splitCell'];
const CONTEXT_MENU_DELETE_ACTIONS: InkioTableActionId[] = ['deleteRow', 'deleteColumn'];

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const CONTEXT_MENU_WIDTH = 200;
const CONTEXT_MENU_HEIGHT = 180;
const CONTEXT_MENU_GUTTER = 8;

/** Place the context menu at the pointer, shifted inside the viewport gutter. */
function placeContextMenu(x: number, y: number, width: number, height: number): { x: number; y: number } {
  const next = computeOverlayPosition({
    anchorRect: { top: y, bottom: y, left: x, right: x, width: 0, height: 0 },
    floatingRect: { width, height },
    placement: 'bottom',
    align: 'start',
    offset: 0,
    padding: CONTEXT_MENU_GUTTER,
    flip: false,
    shift: true,
  });
  return { x: next.left, y: next.top };
}

function resolveActiveTable(editor: Editor): HTMLTableElement | null {
  const { from } = editor.state.selection;
  const nodeDom = editor.view.nodeDOM(from);
  if (nodeDom instanceof HTMLTableElement) {
    return nodeDom;
  }

  const domAtPos = editor.view.domAtPos(from);
  const element = domAtPos.node instanceof Element ? domAtPos.node : domAtPos.node.parentElement;
  return (element?.closest('table') as HTMLTableElement | null) ?? null;
}

function measureTable(table: HTMLTableElement): Omit<TableMetrics, 'origin'> | null {
  const allRows = Array.from(table.rows);
  if (allRows.length === 0 || allRows.every((row) => row.cells.length === 0)) {
    return null;
  }

  // First-row boundaries preserve the legacy guide count (including
  // zero-layout environments where every rect reads 0); edges unique to
  // later rows are added so colspan/rowspan tables still get aligned
  // insert guides instead of first-row-only ones.
  const baseRow = allRows.find((row) => row.cells.length > 0);
  if (!baseRow) return null;
  const headCells = Array.from(baseRow.cells);
  const columns = headCells.map((cell) => cell.getBoundingClientRect().left);
  columns.push(headCells[headCells.length - 1].getBoundingClientRect().right);
  const seen = new Set(columns.map((edge) => Math.round(edge)));
  for (const row of allRows.slice(1)) {
    for (const cell of Array.from(row.cells)) {
      const rect = cell.getBoundingClientRect();
      for (const edge of [rect.left, rect.right]) {
        const rounded = Math.round(edge);
        if (!seen.has(rounded)) {
          seen.add(rounded);
          columns.push(edge);
        }
      }
    }
  }
  columns.sort((a, b) => a - b);

  const rows = allRows.map((row) => row.getBoundingClientRect().top);
  rows.push(allRows[allRows.length - 1].getBoundingClientRect().bottom);

  const rect = table.getBoundingClientRect();
  return { columns, rows, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
}

/**
 * The cell a column insert anchors to. Merged cells leave a row with fewer cells
 * than columns, so its cell indexes don't match boundary indexes: use a row
 * without spans, or when every row has one, the cell touching the boundary.
 */
function findCellAtColumnEdge(
  table: HTMLTableElement,
  columnCount: number,
  columnIndex: number,
  edge: number,
  after: boolean,
): HTMLTableCellElement | null {
  const rows = Array.from(table.rows);
  const fullRow = rows.find((row) => row.cells.length === columnCount);
  if (fullRow) {
    return fullRow.cells[columnIndex];
  }

  for (const row of rows) {
    for (const cell of Array.from(row.cells)) {
      const rect = cell.getBoundingClientRect();
      if (Math.round(after ? rect.right : rect.left) === Math.round(edge)) {
        return cell;
      }
    }
  }
  return null;
}

export const TableMenu = ({
  editor,
  className,
  locale,
  messages: messageOverrides,
  icons: iconOverrides,
}: TableMenuProps) => {
  const [metrics, setMetrics] = useState<TableMetrics | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const hoveredTableRef = useRef<HTMLTableElement | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const ui = useInkioCoreUi({ locale, messages: messageOverrides, icons: iconOverrides });

  const refresh = useCallback(() => {
    if (!editor || editor.isEditable === false) {
      tableRef.current = null;
      setMetrics(null);
      return;
    }

    // Prefer the table the mouse is currently over, then fall back to the
    // table that contains the selection — so hover alone is enough to reveal
    // the controls, and they stay if the cursor is inside.
    let target: HTMLTableElement | null = hoveredTableRef.current;
    if (!target && isTableActive(editor)) {
      target = resolveActiveTable(editor);
    }

    tableRef.current = target;
    const measured = target ? measureTable(target) : null;
    setMetrics(measured && { ...measured, origin: fixedOrigin(editor.view.dom) });
  }, [editor]);

  const cancelHoverClear = useCallback(() => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  const scheduleHoverClear = useCallback(() => {
    if (!hoveredTableRef.current) {
      return;
    }
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = window.setTimeout(() => {
      clearTimerRef.current = null;
      hoveredTableRef.current = null;
      refresh();
    }, 200);
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A single keystroke fires both `transaction` and `selectionUpdate` —
  // coalesce them into one recompute per animation frame. rAF (not microtask)
  // keeps layout reads (getBoundingClientRect in measureTable) out of the
  // keystroke path: bursts of synchronous transactions measure at most once,
  // right before paint. Events arriving while no table can be visible skip
  // measurement entirely.
  const refreshRafRef = useRef<number | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const refreshCoalesced = useCallback(() => {
    if (!hoveredTableRef.current && editor && !isTableActive(editor)) {
      // No hover target and selection outside any table: nothing to show.
      // Clear once if stale metrics linger, otherwise skip the reflow.
      if (tableRef.current !== null) {
        refreshRef.current();
      }
      return;
    }
    if (refreshRafRef.current !== null) {
      return;
    }
    refreshRafRef.current = window.requestAnimationFrame(() => {
      refreshRafRef.current = null;
      refreshRef.current();
    });
  }, [editor]);

  useEffect(() => {
    return () => {
      if (refreshRafRef.current !== null) {
        window.cancelAnimationFrame(refreshRafRef.current);
        refreshRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.on('selectionUpdate', refreshCoalesced);
    editor.on('transaction', refreshCoalesced);
    editor.on('focus', refreshCoalesced);
    return () => {
      editor.off('selectionUpdate', refreshCoalesced);
      editor.off('transaction', refreshCoalesced);
      editor.off('focus', refreshCoalesced);
    };
  }, [editor, refreshCoalesced]);

  useEffect(() => {
    if (!editor || !metrics) {
      return;
    }

    return autoUpdateOverlayPosition({
      update: refresh,
      elements: [editor.view.dom, tableRef.current],
    });
  }, [editor, metrics, refresh]);

  // Right-click inside a table cell opens the action menu.
  useEffect(() => {
    if (!editor) {
      return;
    }

    const dom = editor.view.dom;
    const handleContextMenu = (event: MouseEvent) => {
      if (editor.isEditable === false) {
        return;
      }

      const cell = (event.target as HTMLElement | null)?.closest('td, th') as HTMLElement | null;
      if (!cell || !dom.contains(cell)) {
        return;
      }

      event.preventDefault();
      // Don't scroll: the scroll listener below would close this menu right
      // after it opens.
      const chain = editor.chain().focus(undefined, { scrollIntoView: false });
      if (cell.classList.contains('selectedCell')) {
        // Keep a selection of several cells, or there is nothing left to merge.
        chain.run();
      } else {
        // Land inside the cell's first textblock (a selection at the cell
        // boundary is not a valid TextSelection).
        const textblock = cell.querySelector('p, h1, h2, h3, h4, h5, h6') ?? cell;
        chain.setTextSelection(editor.view.posAtDOM(textblock, 0)).run();
      }
      setContextMenu(
        {
          ...placeContextMenu(event.clientX, event.clientY, CONTEXT_MENU_WIDTH, CONTEXT_MENU_HEIGHT),
          anchor: { x: event.clientX, y: event.clientY },
          origin: fixedOrigin(dom),
        },
      );
    };

    dom.addEventListener('contextmenu', handleContextMenu);
    return () => dom.removeEventListener('contextmenu', handleContextMenu);
  }, [editor]);

  // Reclamp the context menu to the real rendered size: the open-time
  // estimate uses fixed constants, which long i18n labels or zoom overflow.
  // Before paint: the menu's height varies, and it must not appear elsewhere first.
  useIsomorphicLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) {
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const { x, y } = placeContextMenu(contextMenu.anchor.x, contextMenu.anchor.y, rect.width, rect.height);
    if (x !== contextMenu.x || y !== contextMenu.y) {
      setContextMenu({ ...contextMenu, x, y });
    }
  }, [contextMenu]);

  // Dismiss the context menu on any outside interaction.
  const isContextMenuOpen = contextMenu !== null;
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  useDismissableLayer({
    refs: [menuRef],
    onDismiss: closeContextMenu,
    enabled: isContextMenuOpen,
    capture: true,
  });

  useEffect(() => {
    if (!isContextMenuOpen) {
      return;
    }

    window.addEventListener('scroll', closeContextMenu, true);
    window.addEventListener('resize', closeContextMenu);
    return () => {
      window.removeEventListener('scroll', closeContextMenu, true);
      window.removeEventListener('resize', closeContextMenu);
    };
  }, [isContextMenuOpen, closeContextMenu]);

  // Track the table currently under the mouse, so the controls reveal on
  // hover without first clicking into the table.
  useEffect(() => {
    if (!editor || editor.isEditable === false) {
      return;
    }

    const dom = editor.view.dom;
    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const table = (target?.closest?.('table') ?? null) as HTMLTableElement | null;
      if (table && dom.contains(table)) {
        cancelHoverClear();
        if (hoveredTableRef.current !== table) {
          hoveredTableRef.current = table;
          refresh();
        }
      } else if (hoveredTableRef.current) {
        scheduleHoverClear();
      }
    };
    const handleMouseLeave = () => {
      scheduleHoverClear();
    };

    dom.addEventListener('mouseover', handleMouseOver);
    dom.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      dom.removeEventListener('mouseover', handleMouseOver);
      dom.removeEventListener('mouseleave', handleMouseLeave);
      cancelHoverClear();
    };
  }, [editor, cancelHoverClear, scheduleHoverClear, refresh]);

  const insertAt = useCallback(
    (axis: 'column' | 'row', index: number) => {
      const table = tableRef.current;
      if (!editor || !table) {
        return;
      }

      if (axis === 'column') {
        const columns = measureTable(table)?.columns;
        if (!columns) {
          return;
        }
        const columnCount = columns.length - 1;
        const after = index >= columnCount;
        const cell = findCellAtColumnEdge(table, columnCount, after ? columnCount - 1 : index, columns[index], after);
        if (cell) {
          runTableCommandAt(editor, editor.view.posAtDOM(cell, 0), after ? 'addColumnAfter' : 'addColumnBefore');
        }
        return;
      }

      const rows = table.rows;
      if (rows.length === 0) {
        return;
      }
      const after = index >= rows.length;
      const cell = rows[after ? rows.length - 1 : index]?.cells[0];
      if (!cell) {
        return;
      }
      runTableCommandAt(editor, editor.view.posAtDOM(cell, 0), after ? 'addRowAfter' : 'addRowBefore');
    },
    [editor],
  );

  const runAction = useCallback(
    (id: InkioTableActionId) => {
      if (editor) {
        executeTableAction(editor, id);
      }
      setContextMenu(null);
    },
    [editor],
  );

  if (!editor) {
    return null;
  }

  // Merge and split appear when they apply: a cell selection, a merged cell.
  const cellActions = contextMenu
    ? CONTEXT_MENU_CELL_ACTIONS.filter((id) => canExecuteTableAction(editor, id))
    : [];

  const renderContextItem = (id: InkioTableActionId, isDanger = false) => {
    const Icon = ui.icons[id as InkioIconId];
    const disabled = !canExecuteTableAction(editor, id);
    return (
      <button
        key={id}
        type="button"
        role="menuitem"
        className={`inkio-table-context-item${isDanger ? ' is-danger' : ''}`}
        disabled={disabled}
        onMouseDown={(event) => {
          event.preventDefault();
          if (!disabled) {
            runAction(id);
          }
        }}
      >
        {Icon && <Icon size={16} strokeWidth={1.8} />}
        <span>{ui.messages.tableMenu[id]}</span>
      </button>
    );
  };

  return (
    <>
      {metrics && (
        <div className={`inkio-table-controls${className ? ` ${className}` : ''}`}>
          {hover && (
            <div
              className={`inkio-table-guide inkio-table-guide--${hover.axis}`}
              style={
                hover.axis === 'column'
                  ? {
                      left: metrics.columns[hover.index] - metrics.origin.x,
                      top: metrics.top - metrics.origin.y,
                      height: metrics.bottom - metrics.top,
                    }
                  : {
                      top: metrics.rows[hover.index] - metrics.origin.y,
                      left: metrics.left - metrics.origin.x,
                      width: metrics.right - metrics.left,
                    }
              }
            />
          )}

          {metrics.columns.map((x, index) => {
            const isLast = index === metrics.columns.length - 1;
            const label = isLast
              ? ui.messages.tableMenu.addColumnAfter
              : ui.messages.tableMenu.addColumnBefore;
            return (
              <button
                key={`column-${index}`}
                type="button"
                className="inkio-table-insert inkio-table-insert--column"
                style={{ left: x - metrics.origin.x, top: metrics.top - metrics.origin.y }}
                title={label}
                aria-label={label}
                onMouseEnter={() => {
                  cancelHoverClear();
                  setHover({ axis: 'column', index });
                }}
                onMouseLeave={() => {
                  scheduleHoverClear();
                  setHover(null);
                }}
                onFocus={() => setHover({ axis: 'column', index })}
                onBlur={() => setHover(null)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertAt('column', index);
                }}
              >
                <ui.icons.insert size={12} strokeWidth={2} aria-hidden />
              </button>
            );
          })}

          {metrics.rows.map((y, index) => {
            const isLast = index === metrics.rows.length - 1;
            const label = isLast
              ? ui.messages.tableMenu.addRowAfter
              : ui.messages.tableMenu.addRowBefore;
            return (
              <button
                key={`row-${index}`}
                type="button"
                className="inkio-table-insert inkio-table-insert--row"
                style={{ left: metrics.left - metrics.origin.x, top: y - metrics.origin.y }}
                title={label}
                aria-label={label}
                onMouseEnter={() => {
                  cancelHoverClear();
                  setHover({ axis: 'row', index });
                }}
                onMouseLeave={() => {
                  scheduleHoverClear();
                  setHover(null);
                }}
                onFocus={() => setHover({ axis: 'row', index })}
                onBlur={() => setHover(null)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertAt('row', index);
                }}
              >
                <ui.icons.insert size={12} strokeWidth={2} aria-hidden />
              </button>
            );
          })}
        </div>
      )}

      {contextMenu && (
        <div
          ref={menuRef}
          className="inkio-table-context-menu"
          role="menu"
          aria-label={ui.messages.actions.table}
          style={{ top: contextMenu.y - contextMenu.origin.y, left: contextMenu.x - contextMenu.origin.x }}
        >
          {cellActions.map((id) => renderContextItem(id))}
          {cellActions.length > 0 && <div className="inkio-table-context-separator" />}
          {CONTEXT_MENU_DELETE_ACTIONS.map((id) => renderContextItem(id, true))}
        </div>
      )}
    </>
  );
};
