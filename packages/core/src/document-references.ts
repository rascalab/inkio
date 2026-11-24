import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

type DocumentNode = JSONContent | ProseMirrorNode;
export interface MentionRef { id: string; label: string }

// Only the node representation differs. Keep validation, order and deduplication
// identical on the server (saved JSON) and in the editor (immutable PM nodes).
function visit(root: DocumentNode, read: (node: DocumentNode) => void): void {
  if ('descendants' in root && typeof root.descendants === 'function') {
    read(root);
    root.descendants(read);
    return;
  }
  // Plain JS inputs can contain repeated or cyclic subtrees. Revisiting one
  // cannot contribute a distinct reference. Avoid recursion on deep JSON.
  const seen = new WeakSet<DocumentNode>();
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    read(node);
    const children = node.content;
    if (Array.isArray(children)) {
      for (let i = children.length - 1; i >= 0; i--) pending.push(children[i]);
    }
  }
}

function typeName(type: string | { name: string } | undefined): string | undefined {
  return typeof type === 'string' ? type : type?.name;
}

export function extractMentions(doc: DocumentNode): MentionRef[] {
  const result: MentionRef[] = [];
  const seen = new Map<string, Set<string>>();
  visit(doc, (node) => {
    if (typeName(node.type) !== 'mention') return;
    const id = node.attrs?.id;
    const label = node.attrs?.label;
    if (typeof id !== 'string' || !id || typeof label !== 'string' || !label) return;
    let labels = seen.get(id);
    if (labels?.has(label)) return;
    if (!labels) seen.set(id, labels = new Set());
    labels.add(label);
    result.push({ id, label });
  });
  return result;
}

export function extractHashtags(doc: DocumentNode): string[] {
  const labels = new Set<string>();
  visit(doc, (node) => {
    if (typeName(node.type) !== 'hashTag') return;
    const label = node.attrs?.label;
    if (typeof label === 'string' && label) labels.add(label.replace(/^#+/, ''));
  });
  return Array.from(labels);
}

/** References, not authorizations. Never truncate the walk: hosts compare IDs on save. */
export function getCommentIds(doc: DocumentNode): string[] {
  const ids = new Set<string>();
  visit(doc, (node) => {
    if (!node.marks) return;
    for (const mark of node.marks) {
      if (typeName(mark.type) !== 'comment') continue;
      const value = mark.attrs?.commentId;
      const id = typeof value === 'string' && value.trim();
      if (id) ids.add(id);
    }
  });
  return Array.from(ids);
}
