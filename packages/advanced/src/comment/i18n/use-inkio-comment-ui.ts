import { useMemo } from 'react';
import {
  useInkioContext,
  useStableOptions,
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
  /**
   * Optional action icons, rendered before the button label when provided:
   * `resolve`, `delete`, `reply`, `submit`. Absent keys keep the default
   * text/glyph buttons.
   */
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
  // Inline `messages`/`icons` literals are new objects every render; compare
  // structurally so the merge below only reruns on real changes.
  const stableMessages = useStableOptions(overrides.messages);
  const stableIcons = useStableOptions(overrides.icons);

  return useMemo(() => {
    const locale = overrides.locale ?? context.locale;
    const providerMessages = toCommentMessageOverrides(context.messages);
    const localMessages = toCommentMessageOverrides(stableMessages);

    return {
      locale,
      messages: mergeCommentMessages(locale, providerMessages, localMessages),
      icons: {
        ...(context.icons ?? {}),
        ...(stableIcons ?? {}),
      },
    };
  }, [context.icons, context.locale, context.messages, stableIcons, overrides.locale, stableMessages]);
}
