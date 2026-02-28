import {
  enCoreMessages,
  resolveCoreMessages,
  mergeCoreMessages,
  toCoreMessageOverrides,
  type InkioCoreMessages,
} from '../messages';

describe('resolveCoreMessages', () => {
  it('returns English messages by default (undefined locale)', () => {
    expect(resolveCoreMessages(undefined)).toEqual(enCoreMessages);
  });

  it('returns English messages for en locale', () => {
    expect(resolveCoreMessages('en')).toEqual(enCoreMessages);
  });

  it('returns English messages for en-US (falls back to en)', () => {
    expect(resolveCoreMessages('en-US')).toEqual(enCoreMessages);
  });

  it('falls back to English for unknown locale', () => {
    expect(resolveCoreMessages('xx-UNKNOWN')).toEqual(enCoreMessages);
  });

  it('applies overrides on top of resolved messages', () => {
    const result = resolveCoreMessages('en', { actions: { bold: 'Strong' } });
    expect(result.actions.bold).toBe('Strong');
    expect(result.actions.italic).toBe(enCoreMessages.actions.italic);
  });

  it('returns same object shape as enCoreMessages', () => {
    const result = resolveCoreMessages(undefined);
    // Check all top-level keys exist
    expect(result).toHaveProperty('actions');
    expect(result).toHaveProperty('linkPopover');
    expect(result).toHaveProperty('suggestion');
    expect(result).toHaveProperty('blockHandle');
  });
});

describe('mergeCoreMessages', () => {
  it('applies multiple overrides in order', () => {
    const result = mergeCoreMessages(
      'en',
      { actions: { bold: 'Strong' } },
      { actions: { bold: 'B' } },
    );
    expect(result.actions.bold).toBe('B');
  });

  it('merges deeply nested overrides', () => {
    const result = mergeCoreMessages('en', {
      linkPopover: { save: 'Apply' },
    });
    expect(result.linkPopover.save).toBe('Apply');
    expect(result.linkPopover.cancel).toBe(enCoreMessages.linkPopover.cancel);
    expect(result.linkPopover.placeholder).toBe(enCoreMessages.linkPopover.placeholder);
  });

  it('handles undefined overrides gracefully', () => {
    const result = mergeCoreMessages('en', undefined, undefined);
    expect(result).toEqual(enCoreMessages);
  });
});

describe('toCoreMessageOverrides', () => {
  it('returns undefined for falsy input', () => {
    expect(toCoreMessageOverrides(undefined)).toBeUndefined();
  });

  it('returns direct overrides when not a root override object', () => {
    const overrides = { actions: { bold: 'Strong' } };
    expect(toCoreMessageOverrides(overrides)).toBe(overrides);
  });

  it('extracts core key from root override object', () => {
    const result = toCoreMessageOverrides({
      core: { actions: { comment: 'Discuss' } },
      extensions: {},
    });
    expect(result?.actions?.comment).toBe('Discuss');
  });

  it('returns undefined core when root override has no core key', () => {
    const result = toCoreMessageOverrides({
      extensions: { someKey: 'value' },
    } as any);
    expect(result).toBeUndefined();
  });
});

describe('enCoreMessages completeness', () => {
  it('has no undefined values in actions', () => {
    Object.values(enCoreMessages.actions).forEach((value) => {
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
    });
  });

  it('has no undefined values in linkPopover', () => {
    Object.values(enCoreMessages.linkPopover).forEach((value) => {
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
    });
  });

  it('has no undefined values in suggestion', () => {
    Object.values(enCoreMessages.suggestion).forEach((value) => {
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
    });
  });

  it('has no undefined values in blockHandle', () => {
    Object.values(enCoreMessages.blockHandle).forEach((value) => {
      expect(value).toBeDefined();
      expect(typeof value).toBe('string');
    });
  });

  it('all action message keys are non-empty strings', () => {
    const messages: InkioCoreMessages = enCoreMessages;
    (Object.keys(messages.actions) as Array<keyof InkioCoreMessages['actions']>).forEach((key) => {
      expect(messages.actions[key].length).toBeGreaterThan(0);
    });
  });
});
