// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createCollabProvider, createYDoc, isBrowser, isYDocEmpty } from '../index';

describe('collab server-side import safety', () => {
  it('imports without touching the DOM', () => {
    expect(isBrowser()).toBe(false);
  });

  it('creates and merges Y docs in node', () => {
    const doc = createYDoc();
    expect(isYDocEmpty(doc)).toBe(true);
    const other = createYDoc();
    other.getText('t').insert(0, 'hi');
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(other));
    expect(isYDocEmpty(doc)).toBe(false);
  });

  it('refuses to construct a provider without transport', () => {
    expect(() => createCollabProvider({ docId: 'x' })).toThrow(/url/);
  });
});
