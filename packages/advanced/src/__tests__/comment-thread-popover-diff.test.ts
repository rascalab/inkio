import { describe, expect, it } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { diffTouchesRanges } from '../comment/comment-thread-popover-plugin';

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'text*' },
    text: {},
  },
});

const doc = (...paragraphs: string[]) =>
  schema.node(
    'doc',
    null,
    paragraphs.map((text) => schema.node('paragraph', null, text ? [schema.text(text)] : [])),
  );

// Range covering "mark" in the second paragraph of doc('aaaa', 'xxmarkxx'):
// paragraph 1 spans 0..6, paragraph 2 content starts at 7, "mark" = 9..13.
const markRange = () => [{ from: 9, to: 13 }];

describe('diffTouchesRanges', () => {
  it('reports no change for identical docs', () => {
    const prev = doc('aaaa', 'xxmarkxx');
    expect(diffTouchesRanges(prev, prev, markRange())).toBe(false);
  });

  it('shifts ranges for an edit entirely before them', () => {
    const prev = doc('aaaa', 'xxmarkxx');
    const next = doc('aaaaBB', 'xxmarkxx');
    const ranges = markRange();
    expect(diffTouchesRanges(prev, next, ranges)).toBe(false);
    expect(ranges).toEqual([{ from: 11, to: 15 }]);
    expect(next.textBetween(ranges[0].from, ranges[0].to)).toBe('mark');
  });

  it('leaves ranges alone for an edit entirely after them', () => {
    const prev = doc('aaaa', 'xxmarkxx', 'tail');
    const next = doc('aaaa', 'xxmarkxx', 'tailZZ');
    const ranges = markRange();
    expect(diffTouchesRanges(prev, next, ranges)).toBe(false);
    expect(ranges).toEqual(markRange());
  });

  it('reports edits inside or adjacent to the range', () => {
    const prev = doc('aaaa', 'xxmarkxx');
    expect(diffTouchesRanges(prev, doc('aaaa', 'xxmaQrkxx'), markRange())).toBe(true);
    expect(diffTouchesRanges(prev, doc('aaaa', 'xxmarkQxx'), markRange())).toBe(true);
  });

  it('always recomputes when there are no cached ranges', () => {
    const prev = doc('aaaa');
    expect(diffTouchesRanges(prev, doc('aaaab'), [])).toBe(true);
  });
});
