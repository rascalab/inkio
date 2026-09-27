import type { Node as PMNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

/**
 * Ranges (in the final document) touched by a sequence of transactions —
 * e.g. an update's root transaction plus the ones plugins appended. Each
 * step's new range is mapped through every later step, so the result
 * addresses `transactions[transactions.length - 1].doc`.
 *
 * Deletions yield zero-width ranges at the deletion point. `AttrStep`-style
 * steps (node attribute changes) have an empty step map; their target node
 * is added as `[pos, pos + 1]` so callers still see them.
 */
export function collectChangedRanges(
  transactions: readonly Transaction[],
): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  transactions.forEach((tr, trIndex) => {
    if (!tr.docChanged) return;
    const later = transactions.slice(trIndex + 1);
    tr.steps.forEach((step, stepIndex) => {
      const rest = tr.mapping.slice(stepIndex + 1);
      const mapToFinal = (pos: number, assoc: number) => {
        let mapped = rest.map(pos, assoc);
        for (const next of later) mapped = next.mapping.map(mapped, assoc);
        return mapped;
      };
      step.getMap().forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        ranges.push([mapToFinal(newStart, -1), mapToFinal(newEnd, 1)]);
      });
      const attrPos = (step as { pos?: unknown }).pos;
      if (typeof attrPos === 'number') {
        const mapped = mapToFinal(attrPos, 1);
        ranges.push([mapped, mapped + 1]);
      }
    });
  });
  return ranges;
}

/** Clamp a range into `[0, doc.content.size]`, keeping `from <= to`. */
export function clampRange(doc: PMNode, [from, to]: [number, number]): [number, number] {
  const size = doc.content.size;
  const clampedFrom = Math.max(0, Math.min(from, size));
  return [clampedFrom, Math.max(clampedFrom, Math.min(to, size))];
}
