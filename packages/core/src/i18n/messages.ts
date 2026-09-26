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
    invalidUrl: string;
  };
  suggestion: {
    empty: string;
  };
  blockHandle: {
    menu: string;
    handle: string;
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
    invalidUrl: 'This URL is not allowed.',
  },
  suggestion: {
    empty: 'No results found',
  },
  blockHandle: {
    menu: 'Block actions',
    handle: 'Block handle',
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

// Message trees are at most a few levels deep: beyond this the input is
// adversarial or cyclic, and recursing would overflow the stack.
const MAX_MERGE_DEPTH = 8;

function deepMerge<T>(base: T, override?: DeepPartial<T>, depth = 0): T {
  if (!override) {
    return base;
  }

  if (depth > MAX_MERGE_DEPTH) {
    return base;
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) {
      continue;
    }

    // Prototype-pollution guard: never merge magic keys, even from
    // consumer-supplied message overrides (e.g. JSON parsed payloads).
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    const existing = result[key];

    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value as DeepPartial<typeof existing>, depth + 1);
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
    const { core, extensions: _extensions, ...direct } = input as InkioMessageOverrides &
      Record<string, unknown>;
    void _extensions;
    // Mixed shapes ({ core, ...directKeys }): fold the direct keys over the
    // nested set instead of silently dropping them.
    if (Object.keys(direct).length === 0) {
      return core;
    }
    return deepMerge((core ?? {}) as InkioCoreMessageOverrides, direct as InkioCoreMessageOverrides);
  }

  return input as InkioCoreMessageOverrides;
}

export const koCoreMessages: InkioCoreMessages = {
  actions: {
    undo: '실행 취소',
    redo: '다시 실행',
    bold: '굵게',
    italic: '기울임',
    underline: '밑줄',
    strike: '취소선',
    code: '인라인 코드',
    highlight: '하이라이트',
    textColor: '글자 색',
    subscript: '아래첨자',
    superscript: '위첨자',
    heading1: '제목 1',
    heading2: '제목 2',
    heading3: '제목 3',
    textAlignLeft: '왼쪽 정렬',
    textAlignCenter: '가운데 정렬',
    textAlignRight: '오른쪽 정렬',
    bulletList: '글머리 목록',
    orderedList: '번호 목록',
    taskList: '할 일 목록',
    callout: '콜아웃',
    table: '표',
    toggleList: '토글 목록',
    codeBlock: '코드 블록',
    horizontalRule: '구분선',
    link: '링크 추가',
    unlink: '링크 제거',
    comment: '댓글 달기',
  },
  tableMenu: {
    addColumnBefore: '왼쪽에 열 추가',
    addColumnAfter: '오른쪽에 열 추가',
    deleteColumn: '열 삭제',
    addRowBefore: '위쪽에 행 추가',
    addRowAfter: '아래쪽에 행 추가',
    deleteRow: '행 삭제',
    toggleHeaderColumn: '머리글 열 전환',
    toggleHeaderRow: '머리글 행 전환',
    mergeCells: '셀 병합',
    splitCell: '셀 분할',
    deleteTable: '표 삭제',
  },
  linkPopover: {
    placeholder: 'https://example.com',
    cancel: '취소',
    save: '저장',
    invalidUrl: '허용되지 않은 URL입니다.',
  },
  suggestion: {
    empty: '검색 결과 없음',
  },
  blockHandle: {
    menu: '블록 작업',
    handle: '블록 핸들',
    delete: '삭제',
    duplicate: '복제',
    transformSection: '다음으로 바꾸기',
    text: '텍스트',
    heading1: '제목 1',
    heading2: '제목 2',
    heading3: '제목 3',
    bulletList: '글머리 목록',
    orderedList: '번호 목록',
    callout: '콜아웃',
    codeBlock: '코드 블록',
  },
};

const CORE_MESSAGESETS = {
  en: enCoreMessages,
  ko: koCoreMessages,
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
