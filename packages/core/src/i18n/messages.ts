import { pickMessageLocale } from './locale';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T[K] extends object
  ? DeepPartial<T[K]>
  : T[K];
};

export interface InkioCoreMessages {
  actions: {
    undo: string;
    redo: string;
    bold: string;
    italic: string;
    underline: string;
    strike: string;
    code: string;
    highlight: string;
    textColor: string;
    subscript: string;
    superscript: string;
    heading1: string;
    heading2: string;
    heading3: string;
    textAlignLeft: string;
    textAlignCenter: string;
    textAlignRight: string;
    bulletList: string;
    orderedList: string;
    taskList: string;
    callout: string;
    table: string;
    toggleList: string;
    codeBlock: string;
    horizontalRule: string;
    link: string;
    unlink: string;
    comment: string;
  };
  tableMenu: {
    addColumnBefore: string;
    addColumnAfter: string;
    deleteColumn: string;
    addRowBefore: string;
    addRowAfter: string;
    deleteRow: string;
    toggleHeaderColumn: string;
    toggleHeaderRow: string;
    mergeCells: string;
    splitCell: string;
    deleteTable: string;
  };
  linkPopover: {
    placeholder: string;
    cancel: string;
    save: string;
  };
  suggestion: {
    empty: string;
  };
  blockHandle: {
    delete: string;
    duplicate: string;
    transformSection: string;
    text: string;
    heading1: string;
    heading2: string;
    heading3: string;
    bulletList: string;
    orderedList: string;
    callout: string;
    codeBlock: string;
  };
}

export type InkioCoreMessageOverrides = DeepPartial<InkioCoreMessages>;

export interface InkioMessageOverrides {
  core?: InkioCoreMessageOverrides;
  extensions?: Record<string, unknown>;
}

export const enCoreMessages: InkioCoreMessages = {
  actions: {
    undo: 'Undo',
    redo: 'Redo',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    strike: 'Strikethrough',
    code: 'Inline code',
    highlight: 'Highlight',
    textColor: 'Text color',
    subscript: 'Subscript',
    superscript: 'Superscript',
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    textAlignLeft: 'Align left',
    textAlignCenter: 'Align center',
    textAlignRight: 'Align right',
    bulletList: 'Bullet list',
    orderedList: 'Numbered list',
    taskList: 'Task list',
    callout: 'Callout',
    table: 'Table',
    toggleList: 'Toggle list',
    codeBlock: 'Code block',
    horizontalRule: 'Divider',
    link: 'Add link',
    unlink: 'Remove link',
    comment: 'Add comment',
  },
  tableMenu: {
    addColumnBefore: 'Add column before',
    addColumnAfter: 'Add column after',
    deleteColumn: 'Delete column',
    addRowBefore: 'Add row above',
    addRowAfter: 'Add row below',
    deleteRow: 'Delete row',
    toggleHeaderColumn: 'Toggle header column',
    toggleHeaderRow: 'Toggle header row',
    mergeCells: 'Merge cells',
    splitCell: 'Split cell',
    deleteTable: 'Delete table',
  },
  linkPopover: {
    placeholder: 'https://example.com',
    cancel: 'Cancel',
    save: 'Save',
  },
  suggestion: {
    empty: 'No results found',
  },
  blockHandle: {
    delete: 'Delete',
    duplicate: 'Duplicate',
    transformSection: 'Turn into',
    text: 'Text',
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    bulletList: 'Bullet list',
    orderedList: 'Numbered list',
    callout: 'Callout',
    codeBlock: 'Code block',
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, override?: DeepPartial<T>): T {
  if (!override) {
    return base;
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) {
      continue;
    }

    const existing = result[key];

    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value as DeepPartial<typeof existing>);
      continue;
    }

    result[key] = value;
  }

  return result as T;
}

export function toCoreMessageOverrides(
  input?: InkioCoreMessageOverrides | InkioMessageOverrides,
): InkioCoreMessageOverrides | undefined {
  if (!input) {
    return undefined;
  }

  if ('core' in input || 'extensions' in input) {
    return (input as InkioMessageOverrides).core;
  }

  return input as InkioCoreMessageOverrides;
}

const CORE_MESSAGESETS = {
  en: enCoreMessages,
} as const satisfies Record<string, InkioCoreMessages>;

/** Locale IDs that ship with @inkio/editor. */
export type InkioCoreLocaleId = keyof typeof CORE_MESSAGESETS;

/**
 * Accepted locale input for inkio components.
 * Provides autocomplete for built-in IDs while allowing arbitrary strings.
 */
export type InkioLocaleInput = InkioCoreLocaleId | (string & {});

export function resolveCoreMessages(
  localeInput: unknown,
  overrides?: InkioCoreMessageOverrides,
): InkioCoreMessages {
  const locale = pickMessageLocale(localeInput, Object.keys(CORE_MESSAGESETS));
  return deepMerge((CORE_MESSAGESETS as Record<string, InkioCoreMessages>)[locale] ?? enCoreMessages, overrides);
}

export function mergeCoreMessages(
  localeInput: unknown,
  ...overrides: Array<InkioCoreMessageOverrides | undefined>
): InkioCoreMessages {
  return overrides.reduce<InkioCoreMessages>(
    (acc, current) => deepMerge(acc, current),
    resolveCoreMessages(localeInput),
  );
}
