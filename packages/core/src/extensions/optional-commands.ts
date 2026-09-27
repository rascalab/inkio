import type { Editor } from '@tiptap/core';

/**
 * Commands contributed by optional extensions. Callers may still pass any
 * command name; the union documents the ones Inkio packages rely on.
 */
export type InkioOptionalChainCommand =
  | 'insertTable'
  | 'setCallout'
  | 'setDetails'
  | 'setHeading'
  | 'setHorizontalRule'
  | 'setParagraph'
  | 'toggleBulletList'
  | 'toggleCode'
  | 'toggleCodeBlock'
  | 'toggleHighlight'
  | 'toggleOrderedList'
  | 'toggleStrike'
  | 'toggleTaskList'
  | 'unsetDetails';

type EditorChain = ReturnType<Editor['chain']>;
type CommandName = InkioOptionalChainCommand | (string & {});

/** Calls `target[command]` if registered; undefined when the extension is absent. */
export function callOptionalCommand(
  target: object,
  command: string,
  args?: unknown,
): unknown {
  const fn = (target as Record<string, unknown>)[command];
  if (typeof fn !== 'function') {
    return undefined;
  }

  return args === undefined
    ? (fn as () => unknown).call(target)
    : (fn as (value: unknown) => unknown).call(target, args);
}

export function hasOptionalCommand(target: object, command: string): boolean {
  return typeof (target as Record<string, unknown>)[command] === 'function';
}

export function runOptionalChainCommand(
  editor: Editor,
  command: CommandName,
  options: {
    args?: unknown;
    prepare?: (chain: EditorChain) => EditorChain;
  } = {},
): boolean {
  const initialChain = editor.chain().focus();
  const preparedChain = options.prepare ? options.prepare(initialChain) : initialChain;
  return runOptionalPreparedChainCommand(preparedChain, command, options.args);
}

export function runOptionalPreparedChainCommand(
  preparedChain: EditorChain,
  command: CommandName,
  args?: unknown,
): boolean {
  if (!hasOptionalCommand(preparedChain, command)) {
    return false;
  }

  const result = callOptionalCommand(preparedChain, command, args);

  if (result && typeof (result as { run?: unknown }).run === 'function') {
    return Boolean((result as { run: () => boolean }).run());
  }

  if (typeof (preparedChain as { run?: unknown }).run === 'function') {
    return Boolean((preparedChain as { run: () => boolean }).run());
  }

  return false;
}

/** Runs a single (non-chained) command if registered. */
export function runOptionalCommand(editor: Editor, command: CommandName, args?: unknown): boolean {
  return Boolean(callOptionalCommand(editor.commands, command, args));
}

export function canRunOptionalCommand(editor: Editor, command: CommandName, args?: unknown): boolean {
  const can = editor.can?.();
  return can ? Boolean(callOptionalCommand(can, command, args)) : false;
}

export function hasEditorExtension(editor: Editor | null, name: string): boolean {
  if (!editor) {
    return false;
  }
  const extensions = editor.extensionManager?.extensions ?? [];
  return extensions.some((extension) => extension.name === name);
}
