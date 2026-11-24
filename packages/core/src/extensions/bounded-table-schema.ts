import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import type { Fragment, Node as ProseMirrorNode } from '@tiptap/pm/model';
import {
  assertTableSize,
  clampTableSpan,
  MAX_TABLE_SPAN,
  normalizeColumnWidths,
  TableBounds,
  TableContentError,
  validateColumnWidths,
  validateTableSpan,
} from '../utils/table-bounds';

function readColumnWidths(element: HTMLElement): number[] | null {
  const widths = element.getAttribute('colwidth');
  if (widths) {
    return normalizeColumnWidths(widths.split(',', MAX_TABLE_SPAN + 1).map((width) => Number.parseInt(width, 10)));
  }

  // Prefer the cell's explicit widths, with the upstream colgroup fallback
  // limited to this table (not a nested table in a different cell).
  let index = (element as HTMLTableCellElement).cellIndex;
  if (index < 0 || index >= MAX_TABLE_SPAN) return null;
  const table = element.closest('table');
  if (!table) return null;
  for (const group of table.children) {
    if (group.tagName !== 'COLGROUP') continue;
    if (index < group.children.length) {
      const width = group.children[index]?.getAttribute('width');
      return width ? normalizeColumnWidths([Number.parseInt(width, 10)]) : null;
    }
    index -= group.children.length;
  }
  return null;
}

const boundedCellAttributes = {
  colspan: {
    default: 1,
    validate: validateTableSpan,
    parseHTML: (element: HTMLElement) => clampTableSpan(element.getAttribute('colspan')),
    renderHTML: (attrs: Record<string, unknown>) => ({ colspan: clampTableSpan(attrs.colspan) }),
  },
  rowspan: {
    default: 1,
    validate: validateTableSpan,
    parseHTML: (element: HTMLElement) => clampTableSpan(element.getAttribute('rowspan')),
    renderHTML: (attrs: Record<string, unknown>) => ({ rowspan: clampTableSpan(attrs.rowspan) }),
  },
  colwidth: {
    default: null,
    validate: validateColumnWidths,
    parseHTML: readColumnWidths,
    renderHTML: (attrs: Record<string, unknown>) => ({ colwidth: normalizeColumnWidths(attrs.colwidth) }),
  },
};

export const BoundedTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...boundedCellAttributes };
  },
});

export const BoundedTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...boundedCellAttributes };
  },
});

function measureDomTable(table: HTMLTableElement): void {
  if (!table.rows) return;
  const bounds = new TableBounds();
  assertTableSize(0, table.rows.length);
  for (const row of table.rows) {
    bounds.startRow();
    for (const cell of row.cells) {
      bounds.addCell(clampTableSpan(cell.getAttribute('colspan')), clampTableSpan(cell.getAttribute('rowspan')));
    }
  }
}

export function addModelRow(bounds: TableBounds, cells: Fragment): void {
  bounds.startRow();
  cells.forEach(({ attrs }) => {
    validateTableSpan(attrs.colspan);
    validateTableSpan(attrs.rowspan);
    validateColumnWidths(attrs.colwidth);
    bounds.addCell(attrs.colspan, attrs.rowspan);
  });
}

const checkedTableLayouts = new WeakSet<ProseMirrorNode>();

export function checkModelTable(table: ProseMirrorNode): void {
  if (checkedTableLayouts.has(table)) return;
  const bounds = new TableBounds();
  assertTableSize(0, table.childCount);
  table.forEach((row) => addModelRow(bounds, row.content));
  checkedTableLayouts.add(table);
}

export function reportRejectedTable(error: unknown): boolean {
  if (!(error instanceof RangeError)) throw error;
  console.warn(error.message);
  return true;
}

export const BoundedTableSchema = Table.extend({
  parseHTML() {
    return [
      {
        tag: 'table',
        ignore: true,
        getAttrs: (element) => {
          try {
            measureDomTable(element as HTMLTableElement);
            return false; // Continue into the standard table rule.
          } catch (error) {
            if (!(error instanceof TableContentError)) throw error;
            reportRejectedTable(error);
            return null; // Skip only this table; do not clear surrounding content.
          }
        },
      },
      ...(this.parent?.() ?? []),
    ];
  },

  renderHTML(props) {
    checkModelTable(props.node);
    return this.parent!(props);
  },
});
