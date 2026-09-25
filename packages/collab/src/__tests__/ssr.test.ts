// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  INKIO_COLLAB_NAMESPACE,
  INKIO_REMOTE_ORIGIN,
  SocketIOCollabProvider,
  applyRemoteUpdate,
  createYDoc,
  isBrowser,
  isYDocEmpty,
} from '../index';

describe('collab server-side import safety', () => {
  it('imports without touching the DOM', () => {
    expect(isBrowser()).toBe(false);
    expect(INKIO_COLLAB_NAMESPACE).toBe('/inkio-collab');
    expect(INKIO_REMOTE_ORIGIN).toBe('inkio-collab-remote');
  });

  it('creates and merges Y docs in node', () => {
    const doc = createYDoc();
    expect(isYDocEmpty(doc)).toBe(true);
    const other = createYDoc();
    other.getText('t').insert(0, 'hi');
    applyRemoteUpdate(doc, Y.encodeStateAsUpdate(other));
    expect(isYDocEmpty(doc)).toBe(false);
    expect(doc.getText('t').toString()).toBe('hi');
  });

  it('refuses to construct a provider without transport', () => {
    expect(() => new SocketIOCollabProvider({ docId: 'x' })).toThrow(/socket.*url/);
  });
});
