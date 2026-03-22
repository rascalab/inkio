// Core Components
export { Editor } from './components/Editor';
export type { EditorProps } from './components/Editor';
export type { HeadingItem } from './components/ToC';
export { getHeadingsFromContent, getHeadingsFromDoc } from './components/ToC';

// Menus
export { BubbleMenu } from './components/BubbleMenu';
export type { BubbleMenuProps } from './components/BubbleMenu';
export { FloatingMenu } from './components/FloatingMenu';
export type { FloatingMenuProps } from './components/FloatingMenu';
export { Toolbar } from './components/Toolbar';
export type { ToolbarProps } from './components/Toolbar';
export { TableMenu } from './components/TableMenu';
export type { TableMenuProps } from './components/TableMenu';
export {
  defaultBubbleMenuActions,
  defaultFloatingMenuActions,
  defaultToolbarActions,
  getToolbarActionsFor,
  splitToolbarActionGroups,
} from './menus/actions';
export type {
  BuiltinInkioToolbarActionId,
  InkioMenuSurface,
  InkioToolbarAction,
  InkioToolbarActionContext,
  InkioToolbarActionId,
  InkioToolbarActionTransform,
} from './menus/actions';
export type { Editor as TiptapEditor } from '@tiptap/react';



// Suggestion UI
export { SuggestionList } from './components/SuggestionList';
export type { SuggestionItem, SuggestionListProps, SuggestionListRef } from './components/SuggestionList';
export { createSuggestionRenderer } from './components/create-suggestion-renderer';
export type { CreateSuggestionRendererOptions } from './components/create-suggestion-renderer';

// Hooks
export { useInkioEditor } from './hooks/use-inkio-editor';
export type { UseInkioEditorOptions } from './hooks/use-inkio-editor';

// Context (Optional convenience)
export { InkioProvider, useInkioContext } from './context/InkioProvider';
export type { InkioProviderProps } from './context/InkioProvider';
export { useInkioCoreUi } from './context/use-inkio-ui';
export type { InkioCoreUiOverrides, ResolvedInkioCoreUi } from './context/use-inkio-ui';

// Adapter (type-only — used by internal packages, not re-exported from wrapper packages)
export type { InkioAdapter } from './adapter';

// Errors
export { InkioError } from './errors';

// Shared Utilities
export { toError } from './utils';
export type { InkioErrorHandler } from './utils';
export { isSafeUrl } from './utils/url-safety';

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

// Core Extensions
export { getExtensions, getExtensions as getDefaultExtensions } from './extensions/get-extensions';
export type { CoreExtensionOptions as ExtensionsOptions, CoreExtensionOptions } from './extensions/get-extensions';
export { LinkClickHandler } from './extensions/LinkClickHandler';
export type { LinkClickHandlerOptions } from './extensions/LinkClickHandler';
export { Callout, CALLOUT_COLOR_PRESETS } from './extensions/Callout';
export type { CalloutOptions } from './extensions/Callout';
export { KeyboardShortcuts } from './extensions/KeyboardShortcuts';

// ToC Component
export { ToC } from './components/TableOfContents';
export type { ToCProps } from './components/TableOfContents';

// ImageBlock
export { ImageBlock } from './extensions/ImageBlock';
export type { ImageBlockOptions, ImageEditorComponentProps } from './extensions/ImageBlock';

// TocBlock
export { TocBlock } from './extensions/TocBlock';
export type { TocBlockOptions } from './extensions/TocBlock';

// Markdown
export {
  createMarkdownAdapter,
  parseMarkdown,
  stringifyMarkdown,
} from './markdown';
export type { MarkdownAdapterOptions } from './markdown';
