import { useMemo } from 'react';
import { mergeCoreMessages, toCoreMessageOverrides } from '../i18n/messages';
import { useStableOptions } from '../utils/stable-options';
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
  const stableLocalMessages = useStableOptions(overrides.messages);
  const stableLocalIcons = useStableOptions(overrides.icons);

  return useMemo(() => {
    const locale = overrides.locale ?? context.locale;
    const providerMessages = toCoreMessageOverrides(context.messages);
    const localMessages = toCoreMessageOverrides(stableLocalMessages);

    return {
      locale,
      messages: mergeCoreMessages(locale, providerMessages, localMessages),
      icons: resolveIconRegistry({
        ...(context.icons ?? {}),
        ...(stableLocalIcons ?? {}),
      }),
    };
  }, [context.icons, context.locale, context.messages, stableLocalIcons, overrides.locale, stableLocalMessages]);
}
