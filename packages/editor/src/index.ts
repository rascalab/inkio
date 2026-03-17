export { Editor } from './components/Editor';
export type { EditorProps } from './components/Editor';
export { Viewer } from './components/Viewer';
export type { ViewerProps } from './components/Viewer';
export type { ExtensionsInput } from './types';
export { getDefaultExtensions } from '@inkio/advanced';
export type { CommentConfig, CommentData } from '@inkio/advanced';
export {
  BubbleMenu,
  FloatingMenu,
  Toolbar,
  TableMenu,
  defaultBubbleMenuActions,
  defaultFloatingMenuActions,
  defaultToolbarActions,
  enCoreMessages,
  ImageBlock,
  InkioProvider,
  pickMessageLocale,
  resolveLocaleInput,
  toPlainText,
  toSummary,
  getContentStats,
} from '@inkio/core';
export type {
  BubbleMenuProps,
  FloatingMenuProps,
  ToolbarProps,
  TableMenuProps,
  BuiltinInkioToolbarActionId,
  InkioCoreLocaleId,
  InkioCoreMessages,
  InkioLocaleInput,
  InkioMessageOverrides,
  InkioProviderProps,
  InkioToolbarAction,
  InkioToolbarActionContext,
  InkioToolbarActionId,
  InkioToolbarActionTransform,
  TiptapEditor,
} from '@inkio/core';
