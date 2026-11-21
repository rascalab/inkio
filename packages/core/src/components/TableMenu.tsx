import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { InkioIconId, InkioIconRegistry } from '../icons/registry';
import type {
  InkioCoreMessageOverrides,
  InkioLocaleInput,
  InkioMessageOverrides,
} from '../i18n/messages';
import { useInkioCoreUi } from '../context/use-inkio-ui';
import { autoUpdateOverlayPosition, computeOverlayPosition, fixedOrigin, type InkioMenuPosition } from '../overlay/positioning';
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
  /** Placement of the context menu around the pointer, not the row/column insert controls. */
  position?: InkioMenuPosition;
}

type ColumnBoundary = { x: number; cell: HTMLTableCellElement; after: boolean };

/** Viewport geometry of the active table, used to place the insert affordances. */
type TableMetrics = {
  columns: ColumnBoundary[];
  /** y of every row boundary — length is rowCount + 1. */
  rows: number[];
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** What a table wider than the editor shows while it scrolls sideways. */
  viewLeft: number;
  viewRight: number;
  /** Subtract from the viewport coordinates above when placing a fixed element. */
  origin: { x: number; y: number };
};

type TableGeometry = { table: HTMLTableElement; metrics: TableMetrics | null };

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
function placeContextMenu(
  x: number, y: number, width: number, height: number,
  editorDom: HTMLElement, position?: InkioMenuPosition,
): { x: number; y: number } {
  const next = computeOverlayPosition({
    anchorRect: { top: y, bottom: y, left: x, right: x, width: 0, height: 0 },
    floatingRect: { width, height },
    placement: 'bottom',
    align: 'start',
    offset: 0,
    padding: CONTEXT_MENU_GUTTER,
    flip: false,
    shift: true,
    ...position,
    boundaryRect: position?.boundary === 'editor' ? editorDom.getBoundingClientRect() : undefined,
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
  const rect = table.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
    return null;
  }

  const allRows = Array.from(table.rows);
  const firstRow = allRows.find((row) => row.cells.length > 0);
  if (!firstRow) return null;

  // A complete row gives every edge without reading other cells. The first
  // row defines the grid width; later rows can lack cells due to either span.
  let columnCount = 0;
  for (const cell of firstRow.cells) columnCount += cell.colSpan;
  const fullRow = columnCount === firstRow.cells.length
    ? firstRow
    : allRows.find((row) =>
      row.cells.length === columnCount && Array.from(row.cells).every((cell) => cell.colSpan === 1),
    );
  let columns: ColumnBoundary[];
  if (fullRow) {
    columns = [];
    const cells = fullRow.cells;
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      const bounds = cell.getBoundingClientRect();
      columns.push({ x: bounds.left, cell, after: false });
      if (i === cells.length - 1) columns.push({ x: bounds.right, cell, after: true });
    }
  } else {
    // No row exposes the full grid. Read the visible edges across rows,
    // preferring insert-before but accepting the cell ending at an edge.
    const edges = new Map<number, ColumnBoundary>();
    for (const row of allRows) {
      for (const cell of row.cells) {
        const { left, right } = cell.getBoundingClientRect();
        const start = Math.round(left);
        const end = Math.round(right);
        if (edges.get(start)?.after !== false) edges.set(start, { x: left, cell, after: false });
        if (!edges.has(end)) edges.set(end, { x: right, cell, after: true });
      }
    }
    columns = [...edges.values()].sort((a, b) => a.x - b.x);
  }

  const rows: number[] = [];
  for (let i = 0; i < allRows.length; i += 1) {
    const { top, bottom } = allRows[i].getBoundingClientRect();
    rows.push(top);
    if (i === allRows.length - 1) rows.push(bottom);
  }
  const view = table.closest('.tableWrapper')?.getBoundingClientRect();
  return {
    columns,
    rows,
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    viewLeft: view?.left ?? -Infinity,
    viewRight: view?.right ?? Infinity,
  };
}

function sameMetrics(a: TableMetrics | null, b: TableMetrics | null): boolean {
  if (a === b) return true;
  return a !== null && b !== null
    && a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right
    && a.viewLeft === b.viewLeft && a.viewRight === b.viewRight
    && a.origin.x === b.origin.x && a.origin.y === b.origin.y
    && a.rows.length === b.rows.length && a.rows.every((y, i) => y === b.rows[i])
    && a.columns.length === b.columns.length && a.columns.every(({ x, cell, after }, i) => {
      const other = b.columns[i];
      return x === other.x && cell === other.cell && after === other.after;
    });
}

export const TableMenu = ({
  editor,
  className,
  locale,
  messages: messageOverrides,
  icons: iconOverrides,
  position: menuPosition,
}: TableMenuProps) => {
  const [geometry, setGeometry] = useState<TableGeometry | null>(null);
  const table = geometry?.table ?? null;
  const metrics = geometry?.metrics ?? null;
  const [hover, setHover] = useState<HoverState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const visibilityRef = useRef<{ table: HTMLTableElement; visible: boolean } | null>(null);
  const hoveredTableRef = useRef<HTMLTableElement | null>(null);
  const clearTimerRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const ui = useInkioCoreUi({ locale, messages: messageOverrides, icons: iconOverrides });

  const refresh = useCallback(() => {
    if (!editor || editor.isDestroyed || editor.isEditable === false) {
      tableRef.current = null;
      hoveredTableRef.current = null;
      setGeometry(null);
      return;
    }

    // Prefer the table the mouse is currently over, then fall back to the
    // table that contains the selection — so hover alone is enough to reveal
    // the controls, and they stay if the cursor is inside.
    const dom = editor.view.dom;
    let target = hoveredTableRef.current;
    if (target && !dom.contains(target)) {
      hoveredTableRef.current = null;
      target = null;
    }
    if (!target && isTableActive(editor)) {
      target = resolveActiveTable(editor);
    }

    tableRef.current = target;
    if (!target) {
      setGeometry(null);
      return;
    }

    const visibility = visibilityRef.current;
    const measured = visibility?.table === target && !visibility.visible ? null : measureTable(target);
    const next = measured && { ...measured, origin: fixedOrigin(dom) };
    setGeometry((previous) =>
      previous?.table === target && sameMetrics(previous.metrics, next)
        ? previous
        : { table: target, metrics: next },
    );
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
  const refreshCoalesced = useCallback(() => {
    if (!hoveredTableRef.current && editor && !isTableActive(editor)) {
      // No hover target and selection outside any table: nothing to show.
      // Clear once if stale metrics linger, otherwise skip the reflow.
      if (tableRef.current !== null) {
        refresh();
      }
      return;
    }
    if (refreshRafRef.current !== null) {
      return;
    }
    refreshRafRef.current = window.requestAnimationFrame(() => {
      refreshRafRef.current = null;
      refresh();
    });
  }, [editor, refresh]);

  useEffect(() => {
    return () => {
      if (refreshRafRef.current !== null) {
        window.cancelAnimationFrame(refreshRafRef.current);
        refreshRafRef.current = null;
      }
    };
  }, [editor]);

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
    if (!editor || !table) return;

    // Bind observers to the DOM target, not each geometry snapshot. The
    // auto-updater schedules an initial refresh, so a snapshot dependency
    // would resubscribe and measure every frame even when nothing moves.
    let active = true;
    const stopUpdating = autoUpdateOverlayPosition({
      update: () => {
        if (active && tableRef.current === table) refresh();
      },
      elements: [editor.view.dom, table, table.closest('.tableWrapper')],
    });
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entries) => {
      if (!active || tableRef.current !== table) return;
      const visible = entries[entries.length - 1]?.isIntersecting;
      const previous = visibilityRef.current;
      if (visible === undefined || (previous?.table === table && previous.visible === visible)) return;
      visibilityRef.current = { table, visible };
      refresh();
    });
    observer?.observe(table);
    return () => {
      active = false;
      stopUpdating();
      observer?.disconnect();
      if (visibilityRef.current?.table === table) visibilityRef.current = null;
    };
  }, [editor, table, refresh]);

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
          ...placeContextMenu(event.clientX, event.clientY, CONTEXT_MENU_WIDTH, CONTEXT_MENU_HEIGHT, dom, menuPosition),
          anchor: { x: event.clientX, y: event.clientY },
          origin: fixedOrigin(dom),
        },
      );
    };

    dom.addEventListener('contextmenu', handleContextMenu);
    return () => dom.removeEventListener('contextmenu', handleContextMenu);
  }, [editor, menuPosition]);

  // Reclamp the context menu to the real rendered size: the open-time
  // estimate uses fixed constants, which long i18n labels or zoom overflow.
  // Before paint: the menu's height varies, and it must not appear elsewhere first.
  useIsomorphicLayoutEffect(() => {
    if (!editor || !contextMenu || !menuRef.current) {
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const { x, y } = placeContextMenu(
      contextMenu.anchor.x, contextMenu.anchor.y, rect.width, rect.height, editor.view.dom, menuPosition,
    );
    if (x !== contextMenu.x || y !== contextMenu.y) {
      setContextMenu({ ...contextMenu, x, y });
    }
  }, [editor, contextMenu, menuPosition]);

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
      if (!editor || !table || tableRef.current !== table || !metrics) return;

      if (axis === 'column') {
        const boundary = metrics.columns[index];
        if (boundary && table.contains(boundary.cell)) {
          const { cell, after } = boundary;
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
    [editor, table, metrics],
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
          {hover && hover.index < (hover.axis === 'column' ? metrics.columns.length : metrics.rows.length) && (
            <div
              className={`inkio-table-guide inkio-table-guide--${hover.axis}`}
              style={
                hover.axis === 'column'
                  ? {
                      left: metrics.columns[hover.index].x - metrics.origin.x,
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

          {metrics.columns.map(({ x }, index) => {
            if (x < metrics.viewLeft - 1 || x > metrics.viewRight + 1) return null;
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
                style={{ left: Math.max(metrics.left, metrics.viewLeft) - metrics.origin.x, top: y - metrics.origin.y }}
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
