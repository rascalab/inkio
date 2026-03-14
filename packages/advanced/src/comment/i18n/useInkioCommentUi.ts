import { useMemo } from 'react';
import {
  useInkioContext,
  type InkioLocaleInput,
  type InkioMessageOverrides,
} from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import {
  mergeCommentMessages,
  toCommentMessageOverrides,
  type InkioCommentMessageOverrides,
  type InkioCommentMessages,
} from './messages';

export interface InkioCommentUiOverrides {
  locale?: InkioLocaleInput;
  messages?: InkioCommentMessageOverrides | InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}

export interface ResolvedInkioCommentUi {
  locale: InkioLocaleInput | undefined;
  messages: InkioCommentMessages;
  icons: Partial<InkioIconRegistry>;
}

export function useInkioCommentUi(
  overrides: InkioCommentUiOverrides = {},
): ResolvedInkioCommentUi {
  const context = useInkioContext();

  return useMemo(() => {
    const locale = overrides.locale ?? context.locale;
    const providerMessages = toCommentMessageOverrides(context.messages);
    const localMessages = toCommentMessageOverrides(overrides.messages);

    return {
      locale,
      messages: mergeCommentMessages(locale, providerMessages, localMessages),
      icons: {
        ...(context.icons ?? {}),
        ...(overrides.icons ?? {}),
      },
    };
  }, [context.icons, context.locale, context.messages, overrides.icons, overrides.locale, overrides.messages]);
}
