import { createDocument, type Content } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap';
import * as Y from 'yjs';

/**
 * Fixed author for seed content. Every client that seeds the same content
 * produces byte-identical Yjs structs under this id, and Yjs merges
 * identical structs as one — so concurrent seeding cannot duplicate text.
 */
export const SEED_CLIENT_ID = 0;

export const DEFAULT_COLLAB_FIELD = 'default';

/**
 * Encode `content` as a deterministic Yjs update for the editor fragment.
 * HTML strings need a DOM to parse; pass JSON when seeding on a server.
 */
export function createSeedUpdate(
  schema: Schema,
  content: Content,
  field: string = DEFAULT_COLLAB_FIELD,
): Uint8Array {
  const seedDoc = new Y.Doc();
  seedDoc.clientID = SEED_CLIENT_ID;
  const node = createDocument(content, schema);
  prosemirrorJSONToYXmlFragment(schema, node.toJSON(), seedDoc.getXmlFragment(field));
  const update = Y.encodeStateAsUpdate(seedDoc);
  seedDoc.destroy();
  return update;
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
