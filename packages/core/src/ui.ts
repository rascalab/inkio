// Shared chrome for surfaces that don't mount a Tiptap document editor.
export { InkioProvider, useInkioContext, type InkioProviderProps } from './context/InkioProvider';
export { pickMessageLocale } from './i18n/locale';
export { deepMerge, type InkioLocaleInput, type InkioMessageOverrides } from './i18n/messages';
export { autoUpdateOverlayPosition, computeOverlayPosition } from './overlay/positioning';
export { useDismissableLayer } from './overlay/use-dismissable-layer';
export { createId } from './utils/create-id';
export { useStableOptions } from './utils/stable-options';
export { isSafeUrl } from './utils/url-safety';
