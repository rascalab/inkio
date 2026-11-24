import { read } from '@inkio/core';

describe('saved document references', () => {
  it('extracts mention ids and labels from saved content', () => {
    expect(
      read({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'mention', attrs: { id: 'u1', label: 'alice' } },
              { type: 'text', text: ' ' },
              { type: 'mention', attrs: { id: 'u1', label: 'alice' } },
            ],
          },
        ],
      }).mentions,
    ).toEqual([{ id: 'u1', label: 'alice' }]);
  });

  it('extracts hashtag labels without leading hash characters', () => {
    expect(
      read({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'hashTag', attrs: { id: 't1', label: '#inkio' } },
              { type: 'hashTag', attrs: { id: 't2', label: 'editor' } },
            ],
          },
        ],
      }).hashTags,
    ).toEqual(['inkio', 'editor']);
  });

  it('strips every leading hash, not just one', () => {
    expect(
      read({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'hashTag', attrs: { id: 't1', label: '##inkio' } }],
          },
        ],
      }).hashTags,
    ).toEqual(['inkio']);
  });
});
