// Core Components
export { Editor } from './components/Editor';
export type { EditorProps } from './components/Editor';
export { Viewer } from './components/Viewer';
export type { ViewerProps } from './components/Viewer';

// Menus
export { BubbleMenu } from './components/BubbleMenu';
export type { BubbleMenuProps } from './components/BubbleMenu';
export { FloatingMenu } from './components/FloatingMenu';
export type { FloatingMenuProps } from './components/FloatingMenu';



// Suggestion UI
export { SuggestionList, createSuggestionRenderer } from './components/SuggestionList';
export type { SuggestionItem, SuggestionListProps, SuggestionListRef, CreateSuggestionRendererOptions } from './components/SuggestionList';

// Hooks
export { useInkioEditor } from './hooks/useInkioEditor';
export type { UseInkioEditorOptions } from './hooks/useInkioEditor';

// Adapter
export type { InkioAdapter } from './adapter';
export { isInkioAdapter } from './adapter';

// Context (Optional convenience)
export { InkioProvider, useInkioAdapter, useInkioContext } from './context/InkioProvider';
export type { InkioProviderProps, DefaultExtensionsFactory } from './context/InkioProvider';
export { useInkioCoreUi } from './context/useInkioUi';
export type { InkioCoreUiOverrides, ResolvedInkioCoreUi } from './context/useInkioUi';

// Errors
export { InkioError } from './errors';

// Shared Utilities
export { toError } from './utils';
export type { InkioErrorHandler } from './utils';

// Serialization
export { toPlainText, toSummary, getContentStats } from './serialization';

// i18n
export { resolveLocaleInput, pickMessageLocale } from './i18n';
export { enCoreMessages } from './i18n';
export type {
  DeepPartial,
  InkioCoreLocaleId,
  InkioCoreMessages,
  InkioCoreMessageOverrides,
  InkioLocaleInput,
  InkioMessageOverrides,
} from './i18n';

// Overlay positioning
export {
  computeOverlayPosition,
  autoUpdateOverlayPosition,
  toRectLike,
} from './overlay/positioning';
export type {
  RectLike,
  OverlayPlacement,
  OverlayAlignment,
  OverlayPositionOptions,
  OverlayPositionResult,
  OverlayAutoUpdateOptions,
} from './overlay/positioning';

// Icons and toolbar schema
export {
  inkioToolbarSchema,
  inkioIconRegistry,
  resolveIconRegistry,
  hasEditorExtension,
  isToolbarActionAvailable,
  getToolbarActionsFor,
  splitToolbarActionGroups,
} from './icons/registry';
export type {
  InkioMenuSurface,
  InkioToolbarAction,
  InkioToolbarActionId,
  InkioIconId,
  InkioIconComponent,
  InkioIconRegistry,
} from './icons/registry';

// Core Extensions
export { getDefaultCoreExtensions } from './extensions/defaults';
export type { CoreExtensionOptions } from './extensions/defaults';
export { LinkClickHandler } from './extensions/LinkClickHandler';
export type { LinkClickHandlerOptions } from './extensions/LinkClickHandler';
export { createInkioExtensionRegistry } from './extensions/registry';
export type { InkioExtensionRegistry } from './extensions/registry';

// ImageBlock
export { ImageBlock } from './extensions/ImageBlock';
export type { ImageBlockOptions, ImageEditorComponentProps } from './extensions/ImageBlock';

