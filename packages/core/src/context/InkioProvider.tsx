import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { InkioLocaleInput, InkioMessageOverrides } from '../i18n/messages';
import type { InkioIconRegistry } from '../icons/registry';

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
  const value = useMemo<InkioContextValue>(
    () => ({ locale, messages, icons }),
    [locale, messages, icons],
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
