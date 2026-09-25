import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { InkioLocaleInput, InkioMessageOverrides } from '../i18n/messages';
import type { InkioIconRegistry } from '../icons/registry';
import { useStableOptions } from '../utils/stable-options';

interface InkioContextValue {
  locale?: InkioLocaleInput;
  messages?: InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}

export const InkioContext = createContext<InkioContextValue>({});

export interface InkioProviderProps {
  locale?: InkioLocaleInput;
  messages?: InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
  children: ReactNode;
}

export function InkioProvider({
  locale,
  messages,
  icons,
  children,
}: InkioProviderProps) {
  // Inline option literals from a re-rendering parent must not churn every
  // useInkioCoreUi consumer: stabilize by structure, propagate real changes.
  const stableMessages = useStableOptions(messages);
  const stableIcons = useStableOptions(icons);
  const value = useMemo<InkioContextValue>(
    () => ({ locale, messages: stableMessages, icons: stableIcons }),
    [locale, stableMessages, stableIcons],
  );

  return (
    <InkioContext.Provider value={value}>
      {children}
    </InkioContext.Provider>
  );
}

export function useInkioContext(): InkioContextValue {
  return useContext(InkioContext);
}
