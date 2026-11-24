import type { JSONContent } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { extractHashtags, extractMentions, getCommentIds, type MentionRef } from './document-references';
import { getHeadingsFromContent, type HeadingItem } from './headings/headings';
import { countText, jsonPlainText, summarizeText, type ContentStats, type TextProjection } from './serialization';

/** Lazy projections of one document. Returned collections and their items are read-only. */
export interface InkioDocument {
  readonly text: string;
  readonly stats: Readonly<ContentStats>;
  /** At most maxLength UTF-16 units including the ellipsis (default: 140). */
  summary(maxLength?: number): string;
  readonly mentions: readonly Readonly<MentionRef>[];
  readonly hashTags: readonly string[];
  readonly headings: readonly Readonly<HeadingItem>[];
  /** Referenced thread IDs only, not thread data or access rights. */
  readonly commentIds: readonly string[];
}

type Source = JSONContent | ProseMirrorNode;
export type DocumentCache<N extends Source> = { doc: N; projection?: TextProjection } & {
  [K in Exclude<keyof InkioDocument, 'summary' | 'text'>]?: InkioDocument[K];
};

function freezeItems<T extends object>(items: T[]): readonly Readonly<T>[] {
  for (const item of items) Object.freeze(item);
  return Object.freeze(items);
}

export function documentView<N extends Source>(
  current: () => DocumentCache<N>,
  plainText: (doc: N) => TextProjection,
  headings: (doc: N) => HeadingItem[],
): InkioDocument {
  const projection = (c: DocumentCache<N>) => c.projection ??= plainText(c.doc);
  return {
    get text() { return projection(current()).text; },
    get stats() {
      const c = current();
      return c.stats ??= Object.freeze(countText(projection(c)));
    },
    summary(maxLength = 140) { return maxLength > 0 ? summarizeText(projection(current()).text, maxLength) : ''; },
    get mentions() {
      const c = current();
      return c.mentions ??= freezeItems(extractMentions(c.doc));
    },
    get hashTags() {
      const c = current();
      return c.hashTags ??= Object.freeze(extractHashtags(c.doc));
    },
    get headings() {
      const c = current();
      return c.headings ??= freezeItems(headings(c.doc));
    },
    get commentIds() {
      const c = current();
      return c.commentIds ??= Object.freeze(getCommentIds(c.doc));
    },
  };
}

/** Read an immutable JSON document already in memory. No editor, file or network I/O. */
export function read(json: JSONContent): InkioDocument {
  const cache: DocumentCache<JSONContent> = { doc: json };
  return documentView(() => cache, jsonPlainText, getHeadingsFromContent);
}
