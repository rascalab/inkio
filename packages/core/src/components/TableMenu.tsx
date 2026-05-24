import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { InkioIconId, InkioIconRegistry } from '../icons/registry';
import type {
  InkioCoreMessageOverrides,
  InkioLocaleInput,
  InkioMessageOverrides,
} from '../i18n/messages';
import { useInkioCoreUi } from '../context/use-inkio-ui';
import { autoUpdateOverlayPosition } from '../overlay/positioning';
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
};

type HoverState = { axis: 'column' | 'row'; index: number };
type ContextMenuState = { x: number; y: number };
type ContextMenuEntry = { kind: 'action'; id: InkioTableActionId } | { kind: 'separator' };

const CONTEXT_MENU_ENTRIES: ContextMenuEntry[] = [
  { kind: 'action', id: 'addRowBefore' },
  { kind: 'action', id: 'addRowAfter' },
  { kind: 'action', id: 'addColumnBefore' },
  { kind: 'action', id: 'addColumnAfter' },
  { kind: 'separator' },
  { kind: 'action', id: 'deleteRow' },
  { kind: 'action', id: 'deleteColumn' },
  { kind: 'action', id: 'deleteTable' },
];

const CONTEXT_MENU_WIDTH = 200;
const CONTEXT_MENU_HEIGHT = 264;

function PlusGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d="M6 2.5v7M2.5 6h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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

function measureTable(table: HTMLTableElement): TableMetrics | null {
  const allRows = Array.from(table.rows);
  const headCells = allRows[0] ? Array.from(allRows[0].cells) : [];
  if (allRows.length === 0 || headCells.length === 0) {
    return null;
  }

  const columns = headCells.map((cell) => cell.getBoundingClientRect().left);
  columns.push(headCells[headCells.length - 1].getBoundingClientRect().right);

  const rows = allRows.map((row) => row.getBoundingClientRect().top);
  rows.push(allRows[allRows.length - 1].getBoundingClientRect().bottom);

  const rect = table.getBoundingClientRect();
  return { columns, rows, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
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
    setMetrics(target ? measureTable(target) : null);
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

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    editor.on('focus', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('transaction', refresh);
      editor.off('focus', refresh);
    };
  }, [editor, refresh]);

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
      const pos = editor.view.posAtDOM(cell, 0);
      editor.chain().focus().setTextSelection(pos).run();
      setContextMenu({
        x: Math.max(8, Math.min(event.clientX, window.innerWidth - CONTEXT_MENU_WIDTH - 8)),
        y: Math.max(8, Math.min(event.clientY, window.innerHeight - CONTEXT_MENU_HEIGHT - 8)),
      });
    };

    dom.addEventListener('contextmenu', handleContextMenu);
    return () => dom.removeEventListener('contextmenu', handleContextMenu);
  }, [editor]);

  // Dismiss the context menu on any outside interaction.
  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const close = () => setContextMenu(null);
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [contextMenu]);

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
        const cells = table.rows[0]?.cells;
        if (!cells || cells.length === 0) {
          return;
        }
        const after = index >= cells.length;
        const cell = cells[after ? cells.length - 1 : index];
        runTableCommandAt(editor, editor.view.posAtDOM(cell, 0), after ? 'addColumnAfter' : 'addColumnBefore');
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
                      left: metrics.columns[hover.index],
                      top: metrics.top,
                      height: metrics.bottom - metrics.top,
                    }
                  : {
                      top: metrics.rows[hover.index],
                      left: metrics.left,
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
                style={{ left: x, top: metrics.top }}
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
                <PlusGlyph />
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
                style={{ left: metrics.left, top: y }}
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
                <PlusGlyph />
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
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {CONTEXT_MENU_ENTRIES.map((entry, index) => {
            if (entry.kind === 'separator') {
              return <div key={`separator-${index}`} className="inkio-table-context-separator" />;
            }

            const Icon = ui.icons[entry.id as InkioIconId];
            const label = ui.messages.tableMenu[entry.id];
            const disabled = !canExecuteTableAction(editor, entry.id);
            const isDanger = entry.id === 'deleteRow' || entry.id === 'deleteColumn' || entry.id === 'deleteTable';

            return (
              <button
                key={entry.id}
                type="button"
                role="menuitem"
                className={`inkio-table-context-item${isDanger ? ' is-danger' : ''}`}
                disabled={disabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (!disabled) {
                    runAction(entry.id);
                  }
                }}
              >
                {Icon && <Icon size={15} strokeWidth={1.8} />}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};
