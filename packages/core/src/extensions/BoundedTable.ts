import { Fragment, Node as ProseMirrorNode, type Slice } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { CellSelection, isInTable, selectionCell, TableMap } from '@tiptap/pm/tables';
import type { EditorView } from '@tiptap/pm/view';
import {
  assertTableSize,
  isTableCellType,
  normalizeJsonTables,
  TableBounds,
  validateColumnWidths,
  validateTableSpan,
} from '../utils/table-bounds';
import { addModelRow, BoundedTableSchema, checkModelTable, reportRejectedTable } from './bounded-table-schema';

const checkedSubtrees = new WeakSet<ProseMirrorNode>();

function checkModelTables(node: ProseMirrorNode): void {
  if (checkedSubtrees.has(node)) return;
  if (node.type.name === 'table') checkModelTable(node);
  if (isTableCellType(node.type.name)) {
    validateTableSpan(node.attrs.colspan);
    validateTableSpan(node.attrs.rowspan);
    validateColumnWidths(node.attrs.colwidth);
  }
  node.forEach(checkModelTables);
  checkedSubtrees.add(node);
}

function checkPaste(view: EditorView, slice: Slice): boolean {
  slice.content.forEach(checkModelTables);
  if (!isInTable(view.state)) return false;

  // The table plugin also accepts open slices containing only rows or cells.
  // Check them before it pads them to a rectangle or grows the target table.
  let { content, openStart, openEnd } = slice;
  while (content.childCount === 1 && (content.firstChild?.type.name === 'table' || (openStart > 0 && openEnd > 0))) {
    content = content.firstChild!.content;
    openStart -= 1;
    openEnd -= 1;
  }
  if (!content.firstChild) return true;
  const type = content.firstChild.type.name;
  const pasted = new TableBounds();
  if (type === 'tableRow') content.forEach((row) => addModelRow(pasted, row.content));
  else if (isTableCellType(type)) addModelRow(pasted, content);
  else return false;

  if (pasted.width === 0) return true;
  const { selection } = view.state;
  const cell = selection instanceof CellSelection ? selection.$anchorCell : selectionCell(view.state);
  const start = cell.start(-1);
  const map = TableMap.get(cell.node(-1)); // The target already passed the document guard.
  if (selection instanceof CellSelection) {
    const { left, right } = map.rectBetween(cell.pos - start, selection.$headCell.pos - start);
    // The upstream paste helper extends source columns before clipping rows.
    assertTableSize(right - left, pasted.height);
  } else {
    const { left, top } = map.findCell(cell.pos - start);
    assertTableSize(Math.max(map.width, left + pasted.width), Math.max(map.height, top + pasted.height));
  }
  return false;
}

export const BoundedTable = BoundedTableSchema.extend({
  // Use the shared hooks directly, rather than copying a hook whose
  // this.parent() would call the same hook a second time.
  parseHTML: undefined,
  renderHTML: undefined,

  onBeforeCreate() {
    const { content } = this.editor.options;
    if (content instanceof ProseMirrorNode) checkModelTables(content);
    else if (content instanceof Fragment) content.forEach(checkModelTables);
    else if (content && typeof content === 'object') this.editor.setOptions({ content: normalizeJsonTables(content) });
  },

  addCommands() {
    const parent = this.parent!();
    return {
      ...parent,
      insertTable: (options) => (props) => {
        const { rows = 3, cols = 3 } = options ?? {};
        if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) return false;
        try {
          assertTableSize(cols, rows);
        } catch (error) {
          if (props.dispatch) reportRejectedTable(error);
          return false;
        }
        return parent.insertTable!(options)(props);
      },
    };
  },

  addNodeView() {
    const render = this.parent?.();
    if (!render) return null;
    return (props) => {
      checkModelTable(props.node);
      const view = render(props);
      const update = view.update;
      if (update) {
        const type = props.node.type;
        view.update = (node, decorations, innerDecorations) => {
          if (node.type !== type) return false;
          checkModelTable(node);
          return update.call(view, node, decorations, innerDecorations);
        };
      }
      return view;
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        filterTransaction(tr) {
          if (!tr.docChanged) return true;
          try {
            // Schema-built nodes from collaborative updates need this too:
            // ProseMirror's createChecked validates structure, not attributes.
            checkModelTables(tr.doc);
            return true;
          } catch (error) {
            reportRejectedTable(error);
            return false;
          }
        },
        props: {
          handlePaste(view, _event, slice) {
            if (slice.size === 0) return isInTable(view.state);
            try {
              return checkPaste(view, slice);
            } catch (error) {
              return reportRejectedTable(error);
            }
          },
        },
      }),
      ...(this.parent?.() ?? []),
    ];
  },
});
