export {
  INKIO_COLLAB_NAMESPACE,
  CollabClientEvents,
  CollabServerEvents,
} from './protocol';
export type {
  CollabJoinPayload,
  CollabUpdatePayload,
  CollabAwarenessPayload,
  CollabInitPayload,
  CollabErrorPayload,
  CollabErrorCode,
} from './protocol';
export {
  INKIO_REMOTE_ORIGIN,
  createYDoc,
  isYDocEmpty,
  encodeDocState,
  applyRemoteUpdate,
} from './ydoc';
export { SocketIOCollabProvider, assertValidDocId } from './provider';
export type {
  CollabProvider,
  CollabUser,
  CollabStatus,
  CollabStatusListener,
  SocketIOCollabProviderOptions,
} from './provider';
export {
  COLLAB_CONFLICTING_EXTENSIONS,
  removeConflictingExtensions,
  createCollabExtensions,
} from './extensions';
export type { CollabExtensionsOptions } from './extensions';
export {
  isBrowser,
  useYDoc,
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
