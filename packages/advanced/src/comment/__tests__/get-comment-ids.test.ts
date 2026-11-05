import { getCommentIds } from '../utils';

const commented = (commentId: string) => ({
  type: 'text',
  text: 'x',
  marks: [{ type: 'bold' }, { type: 'comment', attrs: { commentId } }],
});

describe('getCommentIds', () => {
  it('lists each thread once, at any depth', () => {
    expect(getCommentIds({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [commented('a'), { type: 'text', text: 'plain' }, commented('a')] },
        { type: 'blockquote', content: [{ type: 'paragraph', content: [commented('b')] }] },
      ],
    })).toEqual(['a', 'b']);
  });

  it('finds nothing in a document without comments', () => {
    expect(getCommentIds({ type: 'doc', content: [{ type: 'paragraph' }] })).toEqual([]);
  });
});
