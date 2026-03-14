import {
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
  return template.replace('{count}', String(count));
}
