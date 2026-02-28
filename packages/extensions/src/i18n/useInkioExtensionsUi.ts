import { useMemo } from 'react';
import {
  useInkioContext,
  type InkioIconRegistry,
  type InkioLocaleInput,
  type InkioMessageOverrides,
} from '@inkio/editor';
import {
  mergeExtensionsMessages,
  toExtensionsMessageOverrides,
  type InkioExtensionsMessageOverrides,
  type InkioExtensionsMessages,
} from './messages';

export interface InkioExtensionsUiOverrides {
  locale?: InkioLocaleInput;
  messages?: InkioExtensionsMessageOverrides | InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}

export interface ResolvedInkioExtensionsUi {
  locale: InkioLocaleInput | undefined;
  messages: InkioExtensionsMessages;
  icons: Partial<InkioIconRegistry>;
}

export function useInkioExtensionsUi(
  overrides: InkioExtensionsUiOverrides = {},
): ResolvedInkioExtensionsUi {
  const context = useInkioContext();

  return useMemo(() => {
    const locale = overrides.locale ?? context.locale;
    const providerMessages = toExtensionsMessageOverrides(context.messages);
    const localMessages = toExtensionsMessageOverrides(overrides.messages);

    return {
      locale,
      messages: mergeExtensionsMessages(locale, providerMessages, localMessages),
      icons: {
        ...(context.icons ?? {}),
        ...(overrides.icons ?? {}),
      },
    };
  }, [context.icons, context.locale, context.messages, overrides.icons, overrides.locale, overrides.messages]);
}
