export * from './extensions';
export * from './i18n';
export {
  applyExtensionsAdapter,
  isExtensionsAdapter,
  mapExtensionsAdapterToOptions,
} from './adapter';
export type {
  ExtensionsAdapter,
  ExtensionsAdapterOptionsLike,
  ExtensionsCommentAdapter,
  ExtensionsFileAdapter,
  ExtensionsNavigationAdapter,
  ExtensionsSuggestionAdapter,
  ExtensionsSuggestionItems,
  ExtensionsUploadContext,
  ExtensionsUploadResult,
} from './adapter';
export { extractMentions, extractHashtags } from './serialization';
