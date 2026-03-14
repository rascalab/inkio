import { extractHashtags, extractMentions } from '../serialization';

describe('extension serialization helpers', () => {
  it('extracts mention ids and labels from saved content', () => {
    expect(
      extractMentions({
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
      }),
    ).toEqual([{ id: 'u1', label: 'alice' }]);
  });

  it('extracts hashtag labels without leading hash characters', () => {
    expect(
      extractHashtags({
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
      }),
    ).toEqual(['inkio', 'editor']);
  });
});
