import {
  enCoreMessages,
  mergeCoreMessages,
  resolveCoreMessages,
  toCoreMessageOverrides,
} from '../messages';

describe('core messages', () => {
  it('uses english defaults by default', () => {
    expect(resolveCoreMessages(undefined)).toEqual(enCoreMessages);
  });

  it('deep-merges partial overrides safely', () => {
    const merged = mergeCoreMessages('en-US', {
      actions: {
        bold: 'Strong',
      },
      linkPopover: {
        save: 'Apply',
      },
    });

    expect(merged.actions.bold).toBe('Strong');
    expect(merged.actions.italic).toBe(enCoreMessages.actions.italic);
    expect(merged.linkPopover.save).toBe('Apply');
    expect(merged.linkPopover.cancel).toBe(enCoreMessages.linkPopover.cancel);
  });

  it('extracts core namespace from root message overrides', () => {
    const extracted = toCoreMessageOverrides({
      core: { actions: { comment: 'Discuss' } },
      extensions: {},
    });

    expect(extracted?.actions?.comment).toBe('Discuss');
  });
});
