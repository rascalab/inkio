import { read } from '@inkio/core';

const commented = (commentId: string) => ({
  type: 'text',
  text: 'x',
  marks: [{ type: 'bold' }, { type: 'comment', attrs: { commentId } }],
});

describe('saved comment IDs', () => {
  it('lists each thread once, at any depth', () => {
    expect(read({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [commented('a'), { type: 'text', text: 'plain' }, commented('a')] },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [commented('b')] }] },
      ],
    }).commentIds).toEqual(['a', 'b']);
  });

  it('finds nothing in a document without comments', () => {
    expect(read({ type: 'doc', content: [{ type: 'paragraph' }] }).commentIds).toEqual([]);
  });
});
