export const INKIO_COLLAB_NAMESPACE = '/inkio-collab';

export const CollabClientEvents = {
  Join: 'inkio:collab:join',
  Update: 'inkio:collab:update',
  Awareness: 'inkio:collab:awareness',
} as const;

export const CollabServerEvents = {
  Init: 'inkio:collab:init',
  Update: 'inkio:collab:update',
  Awareness: 'inkio:collab:awareness',
  Error: 'inkio:collab:error',
} as const;

export interface CollabJoinPayload {
  docId: string;
  token?: string;
}

export interface CollabUpdatePayload {
  docId: string;
  update: Uint8Array;
}

export interface CollabAwarenessPayload {
  docId: string;
  update: Uint8Array;
}

export interface CollabInitPayload {
  docId: string;
  update: Uint8Array;
}

export type CollabErrorCode = 'unauthorized' | 'forbidden' | 'internal';

export interface CollabErrorPayload {
  docId: string;
  code: CollabErrorCode;
}
