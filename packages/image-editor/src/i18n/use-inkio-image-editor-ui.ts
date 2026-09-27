import { useMemo } from 'react';
import {
  useInkioContext,
  useStableOptions,
  type InkioLocaleInput,
  type InkioMessageOverrides,
} from '@inkio/core';
import type { InkioIconRegistry } from '@inkio/core/icons';
import {
  mergeImageEditorMessages,
  toImageEditorMessageOverrides,
  type InkioImageEditorMessageOverrides,
  type InkioImageEditorMessages,
} from './messages';

export interface InkioImageEditorUiOverrides {
  locale?: InkioLocaleInput;
  messages?: InkioImageEditorMessageOverrides | InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}

export interface ResolvedInkioImageEditorUi {
  locale: InkioLocaleInput | undefined;
  messages: InkioImageEditorMessages;
  icons: Partial<InkioIconRegistry>;
}

export function useInkioImageEditorUi(
  overrides: InkioImageEditorUiOverrides = {},
): ResolvedInkioImageEditorUi {
  const context = useInkioContext();
  // Inline `messages`/`icons` literals are new objects every render; compare
  // structurally so the merge below only reruns on real changes.
  const stableMessages = useStableOptions(overrides.messages);
  const stableIcons = useStableOptions(overrides.icons);

  return useMemo(() => {
    const locale = overrides.locale ?? context.locale;
    const providerMessages = toImageEditorMessageOverrides(context.messages);
    const localMessages = toImageEditorMessageOverrides(stableMessages);

    return {
      locale,
      messages: mergeImageEditorMessages(locale, providerMessages, localMessages),
      icons: {
        ...(context.icons ?? {}),
        ...(stableIcons ?? {}),
      },
    };
  }, [context.icons, context.locale, context.messages, stableIcons, overrides.locale, stableMessages]);
}
