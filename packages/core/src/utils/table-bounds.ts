import type { JSONContent } from '@tiptap/core';

export const MAX_TABLE_ROWS = 512;
export const MAX_TABLE_COLUMNS = 128;
export const MAX_TABLE_SLOTS = 16_384;
export const MAX_TABLE_SPAN = 128;
const MAX_COLUMN_WIDTH = 10_000;

export class TableContentError extends RangeError {}

export function assertTableSize(width: number, height: number): void {
  if (width > MAX_TABLE_COLUMNS || height > MAX_TABLE_ROWS || width * height > MAX_TABLE_SLOTS) {
    throw new TableContentError(
      `[inkio] Table exceeds the ${MAX_TABLE_ROWS}-row, ${MAX_TABLE_COLUMNS}-column, or ${MAX_TABLE_SLOTS}-cell expanded size limit.`,
    );
  }
}

export function clampTableSpan(value: unknown): number {
  const number = typeof value === 'string' && /^\s*\+?\d+\s*$/.test(value) ? Number(value) : value;
  if (typeof number !== 'number' || Number.isNaN(number) || number < 1) return 1;
  return Math.min(MAX_TABLE_SPAN, Math.floor(number));
}

export function validateTableSpan(value: unknown): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_TABLE_SPAN) {
    throw new RangeError(`[inkio] Table cell span must be an integer from 1 to ${MAX_TABLE_SPAN}.`);
  }
}

function isColumnWidth(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_COLUMN_WIDTH;
}

export function normalizeColumnWidths(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TABLE_SPAN) return null;
  for (const width of value) {
    if (!isColumnWidth(width)) return null;
  }
  return value;
}

export function validateColumnWidths(value: unknown): void {
  if (value !== null && normalizeColumnWidths(value) === null) {
    throw new RangeError('[inkio] Invalid table cell column widths.');
  }
}

/** Counts rectangular grid slots, including columns carried into later rows by rowspans. */
export class TableBounds {
  private row = -1;
  private column = 0;
  private readonly occupiedUntil: number[] = [];
  width = 0;
  height = 0;

  startRow(): void {
    this.row += 1;
    this.column = 0;
    this.height = Math.max(this.height, this.row + 1);
    assertTableSize(this.width, this.height);
  }

  addCell(colspan: number, rowspan: number): void {
    // Skip columns already occupied by earlier rows. A cell may not cross
    // another such column; ProseMirror otherwise attempts to repair collisions.
    while ((this.occupiedUntil[this.column] ?? 0) > this.row) this.column += 1;
    const endColumn = this.column + colspan;
    const endRow = this.row + rowspan;
    this.width = Math.max(this.width, endColumn);
    this.height = Math.max(this.height, endRow);
    assertTableSize(this.width, this.height);
    while (this.column < endColumn) {
      if ((this.occupiedUntil[this.column] ?? 0) > this.row) {
        throw new TableContentError('[inkio] Table has overlapping cell spans.');
      }
      if (rowspan > 1) this.occupiedUntil[this.column] = endRow;
      this.column += 1;
    }
  }
}

export function isTableCellType(type: string | undefined): boolean {
  return type === 'tableCell' || type === 'tableHeader';
}

function measureJsonTable(table: JSONContent): TableBounds {
  const bounds = new TableBounds();
  if (Array.isArray(table.content)) {
    assertTableSize(0, table.content.length);
    for (const row of table.content) {
      bounds.startRow();
      if (!Array.isArray(row?.content)) continue;
      for (const cell of row.content) {
        bounds.addCell(clampTableSpan(cell?.attrs?.colspan), clampTableSpan(cell?.attrs?.rowspan));
      }
    }
  }
  return bounds;
}

/** Leaves normal JSON untouched; only rewrites cells whose imported attributes need normalization. */
export function normalizeJsonTables<T extends JSONContent | JSONContent[]>(
  content: T,
  onTable?: (bounds: TableBounds) => void,
): T {
  function visitChildren(children: JSONContent[]): JSONContent[] {
    let next: JSONContent[] | undefined;
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      const normalized = visit(child);
      if (next) next.push(normalized);
      else if (normalized !== child) next = [...children.slice(0, index), normalized];
    }
    return next ?? children;
  }

  function visit(node: JSONContent): JSONContent {
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'table') {
      const bounds = measureJsonTable(node);
      onTable?.(bounds);
    }
    let attrs = node.attrs;
    if (isTableCellType(node.type) && attrs) {
      const colspan = attrs.colspan === undefined ? undefined : clampTableSpan(attrs.colspan);
      const rowspan = attrs.rowspan === undefined ? undefined : clampTableSpan(attrs.rowspan);
      const colwidth = attrs.colwidth === undefined ? undefined : normalizeColumnWidths(attrs.colwidth);
      if (colspan !== attrs.colspan || rowspan !== attrs.rowspan || colwidth !== attrs.colwidth) {
        attrs = { ...attrs };
        if (colspan !== undefined) attrs.colspan = colspan;
        if (rowspan !== undefined) attrs.rowspan = rowspan;
        if (colwidth !== undefined) attrs.colwidth = colwidth;
      }
    }
    const children = Array.isArray(node.content) ? visitChildren(node.content) : node.content;
    if (attrs === node.attrs && children === node.content) return node;
    return {
      ...node,
      ...(attrs !== node.attrs ? { attrs } : {}),
      ...(children !== node.content ? { content: children } : {}),
    };
  }

  return (Array.isArray(content) ? visitChildren(content) : visit(content)) as T;
}
