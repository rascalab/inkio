import type { Editor } from '@tiptap/core';

export type InkioOptionalChainCommand =
  | 'setCallout'
  | 'setHeading'
  | 'setHorizontalRule'
  | 'setParagraph'
  | 'toggleBulletList'
  | 'toggleCode'
  | 'toggleCodeBlock'
  | 'toggleHighlight'
  | 'toggleOrderedList'
  | 'toggleStrike'
  | 'toggleTaskList';

export type InkioOptionalEditorCommand = 'uploadImageBlock';

type EditorChain = ReturnType<Editor['chain']>;

function callOptionalCommand(
  target: Record<string, unknown>,
  command: string,
  args?: unknown,
): unknown {
  const fn = target[command];
  if (typeof fn !== 'function') {
    return undefined;
  }

  return args === undefined
    ? (fn as () => unknown).call(target)
    : (fn as (value: unknown) => unknown).call(target, args);
}

function hasOptionalCommand(target: Record<string, unknown>, command: string): boolean {
  return typeof target[command] === 'function';
}

export function runOptionalChainCommand(
  editor: Editor,
  command: InkioOptionalChainCommand,
  options: {
    args?: unknown;
    prepare?: (chain: EditorChain) => EditorChain;
  } = {},
): boolean {
  const initialChain = editor.chain().focus();
  const preparedChain = options.prepare ? options.prepare(initialChain) : initialChain;
  const chainRecord = preparedChain as Record<string, unknown>;

  if (!hasOptionalCommand(chainRecord, command)) {
    return false;
  }

  const result = callOptionalCommand(chainRecord, command, options.args);

  if (result && typeof (result as { run?: unknown }).run === 'function') {
    return Boolean((result as { run: () => boolean }).run());
  }

  if (typeof (preparedChain as { run?: unknown }).run === 'function') {
    return Boolean((preparedChain as { run: () => boolean }).run());
  }

  return false;
}

export function runOptionalEditorCommand(
  editor: Editor,
  command: InkioOptionalEditorCommand,
  args?: unknown,
): boolean {
  const commands = editor.commands as Record<string, unknown>;

  if (!hasOptionalCommand(commands, command)) {
    return false;
  }

  const result = callOptionalCommand(commands, command, args);
  return typeof result === 'boolean' ? result : Boolean(result);
}
