export { MAX_DOC_ID_LENGTH, assertValidDocId } from './doc-id';
export { createYDoc, isYDocEmpty, encodeDocState } from './ydoc';
export { SEED_CLIENT_ID, DEFAULT_COLLAB_FIELD, createSeedUpdate, seedYDoc } from './seed';
export {
  createCollabProvider,
  getCollabStatus,
  onCollabStatus,
  isReadOnly,
} from './provider';
export type {
  CollabProvider,
  CollabUser,
  CollabStatus,
  CollabStatusListener,
  CollabToken,
  CreateCollabProviderOptions,
} from './provider';
export { HocuspocusProviderWebsocket } from '@hocuspocus/provider';
// Render the hook's editor without installing @tiptap/react next to Inkio
// (a second copy can drift from the @tiptap/core Inkio resolved).
export { EditorContent } from '@tiptap/react';
export {
  COLLAB_CONFLICTING_EXTENSIONS,
  removeConflictingExtensions,
  createCollabExtensions,
} from './extensions';
export type { CollabExtensionsOptions } from './extensions';
export {
  isBrowser,
  useCollabProvider,
  useCollabStatus,
  useCollabPeers,
  useInkioCollaborativeEditor,
} from './hooks';
export type {
  UseCollabProviderOptions,
  CollabPeer,
  UseInkioCollaborativeEditorOptions,
  CollaborativeEditor,
} from './hooks';
export { CollabPresence } from './presence';
export type { CollabPresenceProps } from './presence';
export { persistDocToIndexedDB, loadIndexedDBState } from './persistence';
