import type { Editor } from '@tiptap/core';

export type InkioOptionalChainCommand =
  | 'setCallout'
  | 'setDetails'
  | 'setHeading'
  | 'setParagraph'
  | 'toggleCode'
  | 'toggleHighlight'
  | 'toggleStrike';

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
  return runOptionalPreparedChainCommand(preparedChain, command, options.args);
}

export function runOptionalPreparedChainCommand(
  preparedChain: EditorChain,
  command: InkioOptionalChainCommand,
  args?: unknown,
): boolean {
  const chainRecord = preparedChain as Record<string, unknown>;

  if (!hasOptionalCommand(chainRecord, command)) {
    return false;
  }

  const result = callOptionalCommand(chainRecord, command, args);

  if (result && typeof (result as { run?: unknown }).run === 'function') {
    return Boolean((result as { run: () => boolean }).run());
  }

  if (typeof (preparedChain as { run?: unknown }).run === 'function') {
    return Boolean((preparedChain as { run: () => boolean }).run());
  }

  return false;
}
