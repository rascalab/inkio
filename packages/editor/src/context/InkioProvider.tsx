import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Extensions } from '@tiptap/react';
import type { InkioAdapter } from '../adapter';
import type { InkioLocaleInput, InkioMessageOverrides } from '../i18n/messages';
import type { InkioIconRegistry } from '../icons/registry';

export type DefaultExtensionsFactory = (adapter?: InkioAdapter) => Extensions;

interface InkioContextValue {
  adapter?: InkioAdapter;
  getDefaultExtensions?: DefaultExtensionsFactory;
  locale?: InkioLocaleInput;
  messages?: InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
}

export const InkioAdapterContext = createContext<InkioContextValue>({});

export interface InkioProviderProps {
  adapter?: InkioAdapter;
  /** Factory that returns the full extension set when adapter is provided. */
  getDefaultExtensions?: DefaultExtensionsFactory;
  locale?: InkioLocaleInput;
  messages?: InkioMessageOverrides;
  icons?: Partial<InkioIconRegistry>;
  children: ReactNode;
}

export function InkioProvider({
  adapter,
  getDefaultExtensions,
  locale,
  messages,
  icons,
  children,
}: InkioProviderProps) {
  const value = useMemo<InkioContextValue>(
    () => ({
      adapter,
      getDefaultExtensions,
      locale,
      messages,
      icons,
    }),
    [adapter, getDefaultExtensions, locale, messages, icons],
  );

  return (
    <InkioAdapterContext.Provider value={value}>
      {children}
    </InkioAdapterContext.Provider>
  );
}

export function useInkioAdapter(): InkioAdapter | undefined {
  return useContext(InkioAdapterContext).adapter;
}

export function useInkioContext(): InkioContextValue {
  return useContext(InkioAdapterContext);
}
