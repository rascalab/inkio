// ImageBlock is now in @inkio/core — re-export for backward compatibility
export { ImageBlock } from '@inkio/core';
export type { ImageBlockOptions, ImageEditorComponentProps } from '@inkio/core';
export * from './Callout';
export { calloutToolbarPluginKey } from './CalloutToolbarPlugin';
export * from './WikiLink';
export * from './Mention';
export * from './HashTag';
export * from './SlashCommand';
export * from './KeyboardShortcuts';
export * from './Bookmark';
// BlockHandle
export { BlockHandle, BlockHandleActionMenu, blockHandlePluginKey, defaultBlockMenuIcons } from './BlockHandle';
export type { BlockHandleOptions, BlockMenuIcons } from './BlockHandle';
export * from './defaults';
