import type { Editor } from '@tiptap/react';
import type { InkioIconId } from '../icons/registry';

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

type ChainRecord = Record<string, unknown>;

function invokeCommand(target: ChainRecord, command: string, args?: unknown): unknown {
  const candidate = target[command];
  if (typeof candidate !== 'function') {
    return undefined;
  }

  return args === undefined
    ? (candidate as () => unknown).call(target)
    : (candidate as (value: unknown) => unknown).call(target, args);
}

function invokeChainCommand(editor: Editor, command: string, args?: unknown): boolean {
  const chain = editor.chain().focus();
  const result = invokeCommand(chain as ChainRecord, command, args);

  if (result && typeof (result as { run?: unknown }).run === 'function') {
    return Boolean((result as { run: () => boolean }).run());
  }

  if (typeof (chain as { run?: unknown }).run === 'function') {
    return Boolean((chain as { run: () => boolean }).run());
  }

  return false;
}

function invokeCanCommand(editor: Editor, command: string, args?: unknown): boolean {
  const can = editor.can?.();
  if (!can) {
    return false;
  }

  const result = invokeCommand(can as ChainRecord, command, args);
  return typeof result === 'boolean' ? result : Boolean(result);
}

function hasEditorExtension(editor: Editor | null, name: string): boolean {
  if (!editor) {
    return false;
  }

  const extensions = editor.extensionManager?.extensions ?? [];
  return extensions.some((extension) => extension.name === name);
}

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
    invokeCanCommand(editor, 'insertTable', DEFAULT_TABLE_ARGS)
    || invokeCanCommand(editor, 'insertContent', { type: 'table' })
  );
}

export function insertDefaultTable(editor: Editor): boolean {
  return invokeChainCommand(editor, 'insertTable', DEFAULT_TABLE_ARGS);
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
      return invokeCanCommand(editor, actionId);
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
      return invokeChainCommand(editor, actionId);
    default:
      return false;
  }
}
