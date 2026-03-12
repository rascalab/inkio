// ImageBlock is now in @inkio/editor — re-export for backward compatibility
export { ImageBlock } from '@inkio/editor';
export type { ImageBlockOptions, ImageEditorComponentProps } from '@inkio/editor';
export * from './Callout';
export { calloutToolbarPluginKey } from './CalloutToolbarPlugin';
export * from './WikiLink';
export * from './Mention';
export * from './HashTag';
export * from './SlashCommand';
export * from './KeyboardShortcuts';
export * from './ToggleList';
export * from './SimpleTable';
export * from './Bookmark';
export * from './Equation';
export * from './Comment';
// BlockHandle
export { BlockHandle, BlockHandleActionMenu, blockHandlePluginKey, defaultBlockMenuIcons } from './BlockHandle';
export type { BlockHandleOptions, BlockMenuIcons } from './BlockHandle';
export * from './defaults';
export { ImageEditorModal } from './ImageEditor/ImageEditorModal';
export type { ImageEditorModalProps } from './ImageEditor/ImageEditorModal';
export { CommentPanel, CommentComposer } from './Comment/components';
export type {
  CommentPanelProps,
  CommentThreadData,
  CommentMessage,
  CommentComposerProps,
} from './Comment/components';
