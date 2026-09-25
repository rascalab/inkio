import type { Extensions } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import type * as Y from 'yjs';

export const COLLAB_CONFLICTING_EXTENSIONS = ['history', 'undoRedo'] as const;

export function removeConflictingExtensions(extensions: Extensions): Extensions {
  return extensions.filter((extension) => {
    const name = (extension as { name?: unknown }).name;
    return (
      typeof name !== 'string' ||
      !(COLLAB_CONFLICTING_EXTENSIONS as readonly string[]).includes(name)
    );
  });
}

export interface CollabExtensionsOptions {
  document: Y.Doc;
}

export function createCollabExtensions({
  document,
}: CollabExtensionsOptions): Extensions {
  return [Collaboration.configure({ document })];
}
