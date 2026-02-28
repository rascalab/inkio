import { useMemo } from 'react';
import { mergeCoreMessages, toCoreMessageOverrides } from '../i18n/messages';
import type {
  InkioCoreMessageOverrides,
  InkioCoreMessages,
  InkioLocaleInput,
  InkioMessageOverrides,
} from '../i18n/messages';
import {
  resolveIconRegistry,
  type InkioIconRegistry,
} from '../icons/registry';
import { useInkioContext } from './InkioProvider';

export interface InkioCoreUiOverrides {
  locale?: InkioLocaleInput;
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}

export interface ResolvedInkioCoreUi {
  locale: InkioLocaleInput | undefined;
  messages: InkioCoreMessages;
  icons: InkioIconRegistry;
}

export function useInkioCoreUi(overrides: InkioCoreUiOverrides = {}): ResolvedInkioCoreUi {
  const context = useInkioContext();

  return useMemo(() => {
    const locale = overrides.locale ?? context.locale;
    const providerMessages = toCoreMessageOverrides(context.messages);
    const localMessages = toCoreMessageOverrides(overrides.messages);

    return {
      locale,
      messages: mergeCoreMessages(locale, providerMessages, localMessages),
      icons: resolveIconRegistry({
        ...(context.icons ?? {}),
        ...(overrides.icons ?? {}),
      }),
    };
  }, [context.icons, context.locale, context.messages, overrides.icons, overrides.locale, overrides.messages]);
}
