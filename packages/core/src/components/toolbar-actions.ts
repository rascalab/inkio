import type { Editor } from '@tiptap/react';
import type { InkioIconId } from '../icons/registry';
import { canInsertTable, insertDefaultTable } from '../table/actions';

export type InkioMenuSurface = 'bubble' | 'floating' | 'toolbar';

export type BuiltinInkioToolbarActionId =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'highlight'
  | 'textColor'
  | 'subscript'
  | 'superscript'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'textAlignLeft'
  | 'textAlignCenter'
  | 'textAlignRight'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'callout'
  | 'table'
  | 'toggleList'
  | 'codeBlock'
  | 'horizontalRule'
  | 'link'
  | 'unlink'
  | 'comment';

export type InkioToolbarActionId = BuiltinInkioToolbarActionId | (string & {});

export interface InkioToolbarAction {
  id: InkioToolbarActionId;
  iconId: InkioIconId;
  labelKey?: BuiltinInkioToolbarActionId;
  label?: string;
  extensionNames?: string[];
  surfaces: InkioMenuSurface[];
  group: string;
  run: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
  isDisabled?: (editor: Editor) => boolean;
}

export interface InkioToolbarActionContext {
  editor: Editor;
  surface: InkioMenuSurface;
}

export type InkioToolbarActionTransform = (
  defaults: InkioToolbarAction[],
  context: InkioToolbarActionContext,
) => InkioToolbarAction[];

function canRunOptionalCommand(
  editor: Editor,
  command: string,
  ...args: unknown[]
): boolean {
  const canCommands = editor.can() as Record<string, unknown>;
  const fn = canCommands[command];

  if (typeof fn !== 'function') {
    return false;
  }

  return Boolean((fn as (...innerArgs: unknown[]) => unknown)(...args));
}

function runOptionalCommand(
  editor: Editor,
  command: string,
  ...args: unknown[]
): void {
  const commands = editor.commands as Record<string, unknown>;
  const fn = commands[command];

  if (typeof fn === 'function') {
    (fn as (...innerArgs: unknown[]) => unknown)(...args);
  }
}

function runOptionalDetailsCommand(editor: Editor, command: 'setDetails' | 'unsetDetails'): void {
  const chain = editor.chain().focus();
  const chainRecord = chain as Record<string, unknown>;
  const fn = chainRecord[command];

  if (typeof fn !== 'function') {
    return;
  }

  const result = (fn as () => unknown).call(chainRecord);

  if (result && typeof (result as { run?: unknown }).run === 'function') {
    (result as { run: () => boolean }).run();
    return;
  }

  if (typeof (chain as { run?: unknown }).run === 'function') {
    (chain as { run: () => boolean }).run();
  }
}

const inkioToolbarSchema: InkioToolbarAction[] = [
  {
    id: 'undo',
    iconId: 'undo',
    labelKey: 'undo',
    surfaces: ['toolbar'],
    group: 'history',
    extensionNames: ['history'],
    run: (editor) => runOptionalCommand(editor, 'undo'),
    isDisabled: (editor) => !canRunOptionalCommand(editor, 'undo'),
  },
  {
    id: 'redo',
    iconId: 'redo',
    labelKey: 'redo',
    surfaces: ['toolbar'],
    group: 'history',
    extensionNames: ['history'],
    run: (editor) => runOptionalCommand(editor, 'redo'),
    isDisabled: (editor) => !canRunOptionalCommand(editor, 'redo'),
  },
  {
    id: 'bold',
    iconId: 'bold',
    labelKey: 'bold',
    surfaces: ['bubble', 'toolbar'],
    group: 'inline-primary',
    extensionNames: ['bold'],
    run: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold'),
  },
  {
    id: 'italic',
    iconId: 'italic',
    labelKey: 'italic',
    surfaces: ['bubble', 'toolbar'],
    group: 'inline-primary',
    extensionNames: ['italic'],
    run: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic'),
  },
  {
    id: 'underline',
    iconId: 'underline',
    labelKey: 'underline',
    surfaces: ['bubble', 'toolbar'],
    group: 'inline-primary',
    extensionNames: ['underline'],
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor) => editor.isActive('underline'),
  },
  {
    id: 'strike',
    iconId: 'strike',
    labelKey: 'strike',
    surfaces: ['bubble', 'toolbar'],
    group: 'inline-primary',
    extensionNames: ['strike'],
    run: (editor) => editor.chain().focus().toggleStrike().run(),
    isActive: (editor) => editor.isActive('strike'),
  },
  {
    id: 'code',
    iconId: 'code',
    labelKey: 'code',
    surfaces: ['bubble', 'toolbar'],
    group: 'inline-secondary',
    extensionNames: ['code'],
    run: (editor) => editor.chain().focus().toggleCode().run(),
    isActive: (editor) => editor.isActive('code'),
  },
  {
    id: 'highlight',
    iconId: 'highlight',
    labelKey: 'highlight',
    surfaces: ['bubble', 'toolbar'],
    group: 'inline-secondary',
    extensionNames: ['highlight'],
    run: (editor) => editor.chain().focus().toggleHighlight().run(),
    isActive: (editor) => editor.isActive('highlight'),
  },
  {
    id: 'textColor',
    iconId: 'textColor',
    labelKey: 'textColor',
    surfaces: ['toolbar'],
    group: 'inline-secondary',
    extensionNames: ['color'],
    run: () => {
      // Toolbar owns the text color popover.
    },
    isActive: (editor) => Boolean(editor.getAttributes('textStyle').color),
  },
  {
    id: 'subscript',
    iconId: 'subscript',
    labelKey: 'subscript',
    surfaces: ['toolbar'],
    group: 'inline-secondary',
    extensionNames: ['subscript'],
    run: (editor) => runOptionalCommand(editor, 'toggleSubscript'),
    isActive: (editor) => editor.isActive('subscript'),
  },
  {
    id: 'superscript',
    iconId: 'superscript',
    labelKey: 'superscript',
    surfaces: ['toolbar'],
    group: 'inline-secondary',
    extensionNames: ['superscript'],
    run: (editor) => runOptionalCommand(editor, 'toggleSuperscript'),
    isActive: (editor) => editor.isActive('superscript'),
  },
  {
    id: 'heading1',
    iconId: 'heading1',
    labelKey: 'heading1',
    surfaces: ['floating', 'toolbar'],
    group: 'headings',
    extensionNames: ['heading'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 1 }),
  },
  {
    id: 'heading2',
    iconId: 'heading2',
    labelKey: 'heading2',
    surfaces: ['floating', 'toolbar'],
    group: 'headings',
    extensionNames: ['heading'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 2 }),
  },
  {
    id: 'heading3',
    iconId: 'heading3',
    labelKey: 'heading3',
    surfaces: ['floating', 'toolbar'],
    group: 'headings',
    extensionNames: ['heading'],
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 3 }),
  },
  {
    id: 'textAlignLeft',
    iconId: 'textAlignLeft',
    labelKey: 'textAlignLeft',
    surfaces: ['toolbar'],
    group: 'alignment',
    extensionNames: ['textAlign'],
    run: (editor) => runOptionalCommand(editor, 'setTextAlign', 'left'),
    isActive: (editor) => editor.isActive({ textAlign: 'left' }),
  },
  {
    id: 'textAlignCenter',
    iconId: 'textAlignCenter',
    labelKey: 'textAlignCenter',
    surfaces: ['toolbar'],
    group: 'alignment',
    extensionNames: ['textAlign'],
    run: (editor) => runOptionalCommand(editor, 'setTextAlign', 'center'),
    isActive: (editor) => editor.isActive({ textAlign: 'center' }),
  },
  {
    id: 'textAlignRight',
    iconId: 'textAlignRight',
    labelKey: 'textAlignRight',
    surfaces: ['toolbar'],
    group: 'alignment',
    extensionNames: ['textAlign'],
    run: (editor) => runOptionalCommand(editor, 'setTextAlign', 'right'),
    isActive: (editor) => editor.isActive({ textAlign: 'right' }),
  },
  {
    id: 'bulletList',
    iconId: 'bulletList',
    labelKey: 'bulletList',
    surfaces: ['floating', 'toolbar'],
    group: 'blocks',
    extensionNames: ['bulletList'],
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList'),
  },
  {
    id: 'orderedList',
    iconId: 'orderedList',
    labelKey: 'orderedList',
    surfaces: ['floating', 'toolbar'],
    group: 'blocks',
    extensionNames: ['orderedList'],
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList'),
  },
  {
    id: 'taskList',
    iconId: 'taskList',
    labelKey: 'taskList',
    surfaces: ['floating', 'toolbar'],
    group: 'blocks',
    extensionNames: ['taskList'],
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
    isActive: (editor) => editor.isActive('taskList'),
  },
  {
    id: 'callout',
    iconId: 'callout',
    labelKey: 'callout',
    surfaces: ['floating', 'toolbar'],
    group: 'blocks',
    extensionNames: ['callout'],
    run: (editor) => (editor.chain().focus() as any).toggleCallout().run(),
    isActive: (editor) => editor.isActive('callout'),
  },
  {
    id: 'table',
    iconId: 'table',
    labelKey: 'table',
    surfaces: ['floating', 'toolbar'],
    group: 'insert',
    extensionNames: ['table'],
    run: (editor) => {
      if (!editor.isActive('table')) {
        insertDefaultTable(editor);
      }
    },
    isActive: (editor) => editor.isActive('table'),
    isDisabled: (editor) => !editor.isActive('table') && !canInsertTable(editor),
  },
  {
    id: 'toggleList',
    iconId: 'toggleList',
    labelKey: 'toggleList',
    surfaces: ['floating', 'toolbar'],
    group: 'blocks',
    extensionNames: ['details'],
    run: (editor) => runOptionalDetailsCommand(editor, editor.isActive('details') ? 'unsetDetails' : 'setDetails'),
    isActive: (editor) => editor.isActive('details'),
  },
  {
    id: 'codeBlock',
    iconId: 'codeBlock',
    labelKey: 'codeBlock',
    surfaces: ['floating', 'toolbar'],
    group: 'blocks',
    extensionNames: ['codeBlock'],
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    isActive: (editor) => editor.isActive('codeBlock'),
  },
  {
    id: 'horizontalRule',
    iconId: 'horizontalRule',
    labelKey: 'horizontalRule',
    surfaces: ['floating', 'toolbar'],
    group: 'blocks',
    extensionNames: ['horizontalRule'],
    run: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'link',
    iconId: 'link',
    labelKey: 'link',
    surfaces: ['bubble', 'toolbar'],
    group: 'insert',
    extensionNames: ['link'],
    run: () => {
      // Bubble menu and toolbar own link insertion behavior.
    },
    isActive: (editor) => editor.isActive('link'),
    isDisabled: (editor) => editor.state.selection.empty && !editor.isActive('link'),
  },
  {
    id: 'unlink',
    iconId: 'unlink',
    labelKey: 'unlink',
    surfaces: ['bubble', 'toolbar'],
    group: 'insert',
    extensionNames: ['link'],
    run: (editor) => editor.chain().focus().unsetLink().run(),
    isActive: (editor) => editor.isActive('link'),
  },
  {
    id: 'comment',
    iconId: 'comment',
    labelKey: 'comment',
    surfaces: ['bubble', 'toolbar'],
    group: 'insert',
    extensionNames: ['comment'],
    run: () => {
      // Bubble menu and toolbar own comment request behavior.
    },
    isDisabled: (editor) => editor.state.selection.empty,
  },
];

const cloneAction = (action: InkioToolbarAction): InkioToolbarAction => ({ ...action });

const defaultActionsFor = (surface: InkioMenuSurface) => {
  return inkioToolbarSchema
    .filter((action) => action.surfaces.includes(surface))
    .map(cloneAction);
};

export const defaultBubbleMenuActions = defaultActionsFor('bubble');
export const defaultFloatingMenuActions = defaultActionsFor('floating');
export const defaultToolbarActions = defaultActionsFor('toolbar');

function hasEditorExtension(editor: Editor, name: string): boolean {
  const extensions = editor.extensionManager?.extensions ?? [];
  return extensions.some((extension) => extension.name === name);
}

function isToolbarActionAvailable(editor: Editor, action: InkioToolbarAction): boolean {
  if (!action.extensionNames || action.extensionNames.length === 0) {
    return true;
  }

  return action.extensionNames.every((name) => hasEditorExtension(editor, name));
}

export function getToolbarActionsFor(
  editor: Editor,
  surface: InkioMenuSurface,
  transform?: InkioToolbarActionTransform,
): InkioToolbarAction[] {
  const defaults = (
    surface === 'bubble'
      ? defaultBubbleMenuActions
      : surface === 'floating'
        ? defaultFloatingMenuActions
        : defaultToolbarActions
  )
    .filter((action) => isToolbarActionAvailable(editor, action))
    .map(cloneAction);

  const resolved = transform ? transform(defaults, { editor, surface }) : defaults;
  return resolved.filter((action) => isToolbarActionAvailable(editor, action));
}

export function splitToolbarActionGroups(actions: InkioToolbarAction[]): InkioToolbarAction[][] {
  const groups: InkioToolbarAction[][] = [];

  actions.forEach((action) => {
    const current = groups[groups.length - 1];
    if (!current || current[0].group !== action.group) {
      groups.push([action]);
      return;
    }

    current.push(action);
  });

  return groups;
}
