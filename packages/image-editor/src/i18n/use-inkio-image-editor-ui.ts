import { useMemo } from 'react';
import {
  useInkioContext,
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

  return useMemo(() => {
    const locale = overrides.locale ?? context.locale;
    const providerMessages = toImageEditorMessageOverrides(context.messages);
    const localMessages = toImageEditorMessageOverrides(overrides.messages);

    return {
      locale,
      messages: mergeImageEditorMessages(locale, providerMessages, localMessages),
      icons: {
        ...(context.icons ?? {}),
        ...(overrides.icons ?? {}),
      },
    };
  }, [context.icons, context.locale, context.messages, overrides.icons, overrides.locale, overrides.messages]);
}
