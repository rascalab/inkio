import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { referenceLabel, walkDocumentNodes } from './serialization';

type DocumentNode = JSONContent | ProseMirrorNode;
export interface MentionRef { id: string; label: string }

// Only the node representation differs. Keep validation, order and deduplication
// identical on the server (saved JSON) and in the editor (immutable PM nodes).
function visit(root: DocumentNode, read: (node: DocumentNode) => void): void {
  // Re-reading a shared saved subtree cannot contribute any new references.
  // Live nodes are immutable and the iterative walker needs no cycle checks.
  const seen = typeof root.type === 'object' ? undefined : new WeakSet<DocumentNode>();
  walkDocumentNodes(root, node => {
    if (seen?.has(node)) return false;
    seen?.add(node);
    read(node);
  });
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
    const label = referenceLabel(node.attrs);
    if (typeof id !== 'string' || !id.trim() || typeof label !== 'string' || !label.trim()) return;
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
    const label = referenceLabel(node.attrs);
    if (typeof label !== 'string') return;
    const tag = label.replace(/^#+/, '');
    if (tag.trim()) labels.add(tag);
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
