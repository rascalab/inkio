import {
  deepMerge,
  pickMessageLocale,
  type DeepPartial,
  type InkioCoreMessageOverrides,
  type InkioMessageOverrides,
} from '@inkio/core';

export interface InkioCommentMessages {
  commentPanel: {
    title: string;
    all: string;
    open: string;
    resolved: string;
    emptyNoComments: string;
    emptyNoMatch: string;
    noMessages: string;
    replyPlaceholder: string;
    resolve: string;
    delete: string;
    quoteHint: string;
    you: string;
    time: {
      justNow: string;
      minutesAgo: string;
      hoursAgo: string;
      daysAgo: string;
    };
  };
  commentComposer: {
    placeholder: string;
    cancel: string;
    submit: string;
  };
}

export type InkioCommentMessageOverrides = DeepPartial<InkioCommentMessages>;

export const koCommentMessages: InkioCommentMessages = {
  commentPanel: {
    title: '댓글',
    all: '전체',
    open: '미해결',
    resolved: '해결됨',
    emptyNoComments: '아직 댓글이 없습니다. 텍스트를 선택하고 댓글 달기를 사용하세요.',
    emptyNoMatch: '일치하는 댓글이 없습니다.',
    noMessages: '아직 메시지가 없습니다.',
    replyPlaceholder: '답글…',
    resolve: '해결',
    delete: '삭제',
    quoteHint: '스레드를 선택하면 강조 표시된 텍스트로 이동합니다.',
    you: '나',
    time: {
      justNow: '방금',
      minutesAgo: '{count}분 전',
      hoursAgo: '{count}시간 전',
      daysAgo: '{count}일 전',
    },
  },
  commentComposer: {
    placeholder: '댓글 달기…',
    cancel: '취소',
    submit: '댓글',
  },
};

export const enCommentMessages: InkioCommentMessages = {
  commentPanel: {
    title: 'Comments',
    all: 'All',
    open: 'Open',
    resolved: 'Resolved',
    emptyNoComments: 'No comments yet. Select text and use the comment action to add one.',
    emptyNoMatch: 'No matching comments.',
    noMessages: 'No messages yet.',
    replyPlaceholder: 'Reply…',
    resolve: 'Resolve',
    delete: 'Delete',
    quoteHint: 'Select a thread to jump to the highlighted text.',
    you: 'You',
    time: {
      justNow: 'just now',
      minutesAgo: '{count}m ago',
      hoursAgo: '{count}h ago',
      daysAgo: '{count}d ago',
    },
  },
  commentComposer: {
    placeholder: 'Add a comment…',
    cancel: 'Cancel',
    submit: 'Comment',
  },
};

function fromRootMessageOverrides(input?: InkioMessageOverrides): InkioCommentMessageOverrides | undefined {
  if (!input?.extensions || typeof input.extensions !== 'object') {
    return undefined;
  }

  return input.extensions as InkioCommentMessageOverrides;
}

export function toCommentMessageOverrides(
  input?: InkioCommentMessageOverrides | InkioMessageOverrides,
): InkioCommentMessageOverrides | undefined {
  if (!input) {
    return undefined;
  }

  if ('core' in input || 'extensions' in input) {
    return fromRootMessageOverrides(input as InkioMessageOverrides);
  }

  return input as InkioCommentMessageOverrides;
}

const COMMENT_MESSAGESETS = {
  en: enCommentMessages,
  ko: koCommentMessages,
} as const satisfies Record<string, InkioCommentMessages>;

export type InkioCommentLocaleId = keyof typeof COMMENT_MESSAGESETS;

export interface InkioTypedCommentMessageOverrides {
  core?: InkioCoreMessageOverrides;
  extensions?: InkioCommentMessageOverrides;
}

export function resolveCommentMessages(
  localeInput: unknown,
  overrides?: InkioCommentMessageOverrides,
): InkioCommentMessages {
  const locale = pickMessageLocale(localeInput, Object.keys(COMMENT_MESSAGESETS));

  return deepMerge(
    (COMMENT_MESSAGESETS as Record<string, InkioCommentMessages>)[locale] ?? enCommentMessages,
    overrides,
  );
}

export function mergeCommentMessages(
  localeInput: unknown,
  ...overrides: Array<InkioCommentMessageOverrides | undefined>
): InkioCommentMessages {
  return overrides.reduce<InkioCommentMessages>(
    (acc, current) => deepMerge(acc, current),
    resolveCommentMessages(localeInput),
  );
}

export function formatRelativeTime(template: string, count: number): string {
  return template.replace(/\{count\}/g, String(count));
}

/**
 * Single shared relative-time formatter for every comment surface.
 * Accepts Date|string|number because persisted thread messages deserialize
 * from JSON with string dates; unparseable input falls back to justNow.
 */
export function formatTimeAgo(
  time: InkioCommentMessages['commentPanel']['time'],
  value: Date | string | number,
): string {
  const epoch = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(epoch)) return time.justNow;
  const seconds = Math.floor((Date.now() - epoch) / 1000);
  if (seconds < 60) return time.justNow;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatRelativeTime(time.minutesAgo, minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatRelativeTime(time.hoursAgo, hours);
  return formatRelativeTime(time.daysAgo, Math.floor(hours / 24));
}
