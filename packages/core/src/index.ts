// Core Components
export { Editor } from './components/Editor';
export type { EditorProps } from './components/Editor';
export { Viewer } from './components/Viewer';
export type { ViewerProps } from './components/Viewer';
export { StaticViewer } from './components/StaticViewer';
export type { StaticViewerProps } from './components/StaticViewer';
export { InkioErrorBoundary } from './components/ErrorBoundary';
export type { InkioErrorBoundaryProps, InkioErrorFallbackProps } from './components/ErrorBoundary';
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
export { isSafeUrl, sanitizeUrlOrEmpty } from './utils/url-safety';
export { mergeExtensions, resolveExtensionsInput } from './utils/extensions-input';
export { resolveInkioExtensions } from './extensions/resolve-extensions';
export type { ExtensionsInput, CoreExtensions } from './utils/extensions-input';
export type { JSONContent as InkioJSONContent } from '@tiptap/core';

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

// Markdown lives behind its own entry point (`@inkio/core/markdown`) so the
// unified/remark dependency chain is never pulled into the editor bundle.
// Import it explicitly when you need markdown serialization.
export type { MarkdownAdapterOptions } from './markdown';
