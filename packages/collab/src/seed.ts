import { createDocument, type Content } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap';
import * as Y from 'yjs';

// Standard Yjs peers choose random 32-bit IDs; reserve a separate range
// for deterministic, 52-bit seed fingerprints.
const SEED_ID_PREFIX = 2 ** 52;
const SEED_ID_MASK = (1n << 52n) - 1n;

export const DEFAULT_COLLAB_FIELD = 'default';

/**
 * Encode a deterministic update. Identical ProseMirror content produces
 * the same seed author. Use the same schema, field and seed for every
 * client of a room. HTML strings need a DOM; use JSON on the server.
 */
export function createSeedUpdate(
  schema: Schema,
  content: Content,
  field: string = DEFAULT_COLLAB_FIELD,
): Uint8Array {
  const json = createDocument(content, schema, undefined, { errorOnInvalidContent: true }).toJSON();
  function encode(clientId: number): Uint8Array {
    const seed = new Y.Doc();
    try {
      seed.clientID = clientId;
      prosemirrorJSONToYXmlFragment(schema, json, seed.getXmlFragment(field));
      return Y.encodeStateAsUpdate(seed);
    } finally {
      seed.destroy();
    }
  }
  let hash = 0xcbf29ce484222325n;
  for (const byte of encode(0)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return encode(SEED_ID_PREFIX + Number(hash & SEED_ID_MASK));
}

/**
 * Seed an empty shared doc. Safe to call from every client at once: the
 * update is deterministic, so racing seeders converge on a single copy.
 * Returns false (and does nothing) when the doc already has content.
 */
export function seedYDoc(
  doc: Y.Doc,
  schema: Schema,
  content: Content,
  field: string = DEFAULT_COLLAB_FIELD,
): boolean {
  if (doc.getXmlFragment(field).length > 0) return false;
  Y.applyUpdate(doc, createSeedUpdate(schema, content, field));
  return true;
}
