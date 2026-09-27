import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Step } from '@tiptap/pm/transform';
import type { Transaction } from '@tiptap/pm/state';
import { getHeadingsFromDoc, getHeadingElements } from './headings';
import type { HeadingItem } from './headings';

/**
 * Conservative check: could this step change the heading list? Only the
 * changed range is inspected (never a full walk). Anything uncertain
 * returns true — a redundant rescan is always safe.
 */
export function stepMayAffectHeadings(doc: ProseMirrorNode, step: Step): boolean {
  const s = step as unknown as {
    from?: number;
    to?: number;
    pos?: number;
    slice?: { content?: { descendants?: (f: (node: ProseMirrorNode) => boolean | void) => void } };
  };

  // AttrStep-style steps carry only `pos` (e.g. code language, task check):
  // they matter only when targeting a heading itself.
  if (s.from === undefined || s.to === undefined) {
    if (typeof s.pos === 'number') {
      const node = doc.nodeAt(s.pos);
      return node?.type.name === 'heading';
    }
    return true;
  }

  // The range touches an existing heading (edit inside one, or a delete
  // spanning across one).
  let hit = false;
  doc.nodesBetween(Math.max(0, s.from - 1), s.to + 1, (node) => {
    if (node.type.name === 'heading') {
      hit = true;
      return false;
    }
    return true;
  });
  if (hit) return true;

  // Inserted content containing block nodes (paste, split, drop).
  const descendants = s.slice?.content?.descendants;
  if (typeof descendants === 'function') {
    s.slice!.content!.descendants!((node) => {
      if (node.isBlock) {
        hit = true;
        return false;
      }
      return true;
    });
  }
  return hit;
}

export function useHeadings(source: Editor | null | undefined, maxLevel = 3) {
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const headingElsRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (!source) {
      setHeadings([]);
      return;
    }
    const update = () => {
      // Full-doc pass, but it only allocates when headings actually change
      // (shallow compare below), and onTransaction() already filtered out
      // transactions that cannot affect headings.
      const next = getHeadingsFromDoc(source.state.doc);
      setHeadings(prev => {
        if (prev.length !== next.length) return next;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].level !== next[i].level || prev[i].text !== next[i].text || prev[i].id !== next[i].id) return next;
        }
        return prev;
      });
    };
    update();
    // The `transaction` event (unlike `update`) exposes steps, so plain
    // paragraph typing skips the full-doc walk entirely. Positions are
    // checked against `transaction.before`: a deleted heading is gone from
    // the new doc, so range checks must run on the pre-step document.
    const onTransaction = ({ transaction }: { transaction?: Transaction } = {}) => {
      if (!transaction) {
        update();
        return;
      }
      if (!transaction.docChanged) return;
      const relevant = transaction.steps.some((step) => stepMayAffectHeadings(transaction.before, step));
      if (relevant) {
        update();
      }
    };
    source.on('transaction', onTransaction);
    return () => { source.off('transaction', onTransaction); };
  }, [source]);

  const filtered = useMemo(() => headings.filter((h) => h.level <= maxLevel), [headings, maxLevel]);

  // Structural signature (count + levels). Typing inside a heading yields a
  // new `filtered` array (text/id changed) but the same signature, so DOM
  // queries, observers and layout work keyed on it do not re-run per keystroke.
  const signature = useMemo(() => filtered.map((h) => h.level).join(','), [filtered]);
  const [elementsGeneration, setElementsGeneration] = useState(0);

  const minLevel = useMemo(
    () => (filtered.length > 0 ? Math.min(...filtered.map((h) => h.level)) : 1),
    [filtered],
  );

  // Cache heading DOM elements — re-queried when the heading structure changes.
  useEffect(() => {
    headingElsRef.current = getHeadingElements(source, maxLevel);
  }, [signature, source, maxLevel]);

  // Same structure but a heading element was replaced (e.g. a paste over a
  // whole heading): the cached elements went stale. `contains` is a cheap,
  // layout-free check; re-query and bump the generation only when needed.
  useEffect(() => {
    const container = source?.view?.dom;
    if (container && headingElsRef.current.some((el) => !container.contains(el))) {
      headingElsRef.current = getHeadingElements(source, maxLevel);
      setElementsGeneration((generation) => generation + 1);
    }
  }, [filtered, source, maxLevel]);

  /** Changes only when heading count/levels or the cached DOM elements change. */
  const layoutKey = `${signature}#${elementsGeneration}`;

  const handleClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      headingElsRef.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [],
  );

  return { headings, filtered, minLevel, headingElsRef, handleClick, layoutKey };
}
