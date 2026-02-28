import {
  enExtensionsMessages,
  mergeExtensionsMessages,
  toExtensionsMessageOverrides,
} from '../messages';

describe('extensions messages', () => {
  it('uses english defaults by default', () => {
    const merged = mergeExtensionsMessages(undefined);
    expect(merged.commentComposer.submit).toBe(enExtensionsMessages.commentComposer.submit);
    expect(merged.imageEditor.save).toBe(enExtensionsMessages.imageEditor.save);
  });

  it('deep-merges partial overrides with english fallback', () => {
    const merged = mergeExtensionsMessages('ko-KR', {
      commentComposer: {
        submit: 'Reply',
      },
      commentPanel: {
        resolve: 'Close',
      },
    });

    expect(merged.commentComposer.submit).toBe('Reply');
    expect(merged.commentComposer.cancel).toBe(enExtensionsMessages.commentComposer.cancel);
    expect(merged.commentPanel.resolve).toBe('Close');
    expect(merged.commentPanel.delete).toBe(enExtensionsMessages.commentPanel.delete);
  });

  it('extracts extension namespace from root message overrides', () => {
    const extracted = toExtensionsMessageOverrides({
      core: {},
      extensions: {
        commentPanel: {
          title: 'Kommentare',
        },
      },
    } as any);

    expect(extracted?.commentPanel?.title).toBe('Kommentare');
  });
});
