import type { Editor } from '@tiptap/react';
import type { InkioIconId } from '../icons/registry';
import {
  canRunOptionalCommand,
  hasEditorExtension,
  runOptionalChainCommand,
  runOptionalPreparedChainCommand,
} from '../extensions/optional-commands';

const DEFAULT_TABLE_ARGS = {
  rows: 3,
  cols: 3,
  withHeaderRow: true,
} as const;

export type InkioTableActionId =
  | 'addColumnBefore'
  | 'addColumnAfter'
  | 'deleteColumn'
  | 'addRowBefore'
  | 'addRowAfter'
  | 'deleteRow'
  | 'toggleHeaderColumn'
  | 'toggleHeaderRow'
  | 'mergeCells'
  | 'splitCell'
  | 'deleteTable';

export interface InkioTableAction {
  id: InkioTableActionId;
  iconId: InkioIconId;
  group: 'column' | 'row' | 'cell' | 'delete';
}

export const defaultTableMenuActions: InkioTableAction[] = [
  { id: 'addColumnBefore', iconId: 'addColumnBefore', group: 'column' },
  { id: 'addColumnAfter', iconId: 'addColumnAfter', group: 'column' },
  { id: 'deleteColumn', iconId: 'deleteColumn', group: 'column' },
  { id: 'addRowBefore', iconId: 'addRowBefore', group: 'row' },
  { id: 'addRowAfter', iconId: 'addRowAfter', group: 'row' },
  { id: 'deleteRow', iconId: 'deleteRow', group: 'row' },
  { id: 'toggleHeaderColumn', iconId: 'toggleHeaderColumn', group: 'column' },
  { id: 'toggleHeaderRow', iconId: 'toggleHeaderRow', group: 'row' },
  { id: 'mergeCells', iconId: 'mergeCells', group: 'cell' },
  { id: 'splitCell', iconId: 'splitCell', group: 'cell' },
  { id: 'deleteTable', iconId: 'deleteTable', group: 'delete' },
];

function isTableExtensionAvailable(editor: Editor | null): boolean {
  return hasEditorExtension(editor, 'table');
}

export function isTableActive(editor: Editor | null): boolean {
  return Boolean(
    editor
    && editor.isEditable !== false
    && isTableExtensionAvailable(editor)
    && editor.isActive('table'),
  );
}

export function canInsertTable(editor: Editor | null): boolean {
  if (!editor || editor.isEditable === false || !isTableExtensionAvailable(editor)) {
    return false;
  }

  return (
    canRunOptionalCommand(editor, 'insertTable', DEFAULT_TABLE_ARGS)
    || canRunOptionalCommand(editor, 'insertContent', { type: 'table' })
  );
}

export function insertDefaultTable(editor: Editor): boolean {
  return runOptionalChainCommand(editor, 'insertTable', { args: DEFAULT_TABLE_ARGS });
}

export function canExecuteTableAction(editor: Editor | null, actionId: InkioTableActionId): boolean {
  if (!editor || editor.isEditable === false || !isTableActive(editor)) {
    return false;
  }

  switch (actionId) {
    case 'addColumnBefore':
    case 'addColumnAfter':
    case 'deleteColumn':
    case 'addRowBefore':
    case 'addRowAfter':
    case 'deleteRow':
    case 'toggleHeaderColumn':
    case 'toggleHeaderRow':
    case 'mergeCells':
    case 'splitCell':
    case 'deleteTable':
      return canRunOptionalCommand(editor, actionId);
    default:
      return false;
  }
}

export function executeTableAction(editor: Editor, actionId: InkioTableActionId): boolean {
  switch (actionId) {
    case 'addColumnBefore':
    case 'addColumnAfter':
    case 'deleteColumn':
    case 'addRowBefore':
    case 'addRowAfter':
    case 'deleteRow':
    case 'toggleHeaderColumn':
    case 'toggleHeaderRow':
    case 'mergeCells':
    case 'splitCell':
    case 'deleteTable':
      return runOptionalChainCommand(editor, actionId);
    default:
      return false;
  }
}

export type TableInsertCommand = 'addColumnBefore' | 'addColumnAfter' | 'addRowBefore' | 'addRowAfter';

/**
 * Move the selection into `pos`, then run a table insert command. Table
 * commands act on the current cell selection, so this is how a boundary-anchored
 * insert (the `+` buttons) targets a specific row/column.
 */
export function runTableCommandAt(editor: Editor, pos: number, command: TableInsertCommand): boolean {
  // setTextSelection throws on out-of-range positions; sibling helpers
  // return false instead, so validate before touching the chain. When the
  // doc shape is unavailable the raw pos passes through (legacy behavior).
  if (!Number.isFinite(pos)) {
    return false;
  }
  const size = editor.state.doc?.content?.size;
  const safePos =
    typeof size === 'number' && Number.isFinite(size)
      ? Math.max(0, Math.min(Math.floor(pos), size))
      : pos;
  const chain = editor.chain().focus().setTextSelection(safePos);
  return runOptionalPreparedChainCommand(chain, command);
}
