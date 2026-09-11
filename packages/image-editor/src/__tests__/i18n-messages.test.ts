import { describe, expect, it } from 'vitest';
import { mergeImageEditorMessages } from '../i18n/messages';

// Same-pattern prototype-pollution guard as @inkio/core deepMerge.
describe('image-editor i18n deepMerge prototype guard', () => {
  it('ignores __proto__ / constructor / prototype keys', () => {
    const malicious = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"polluted":true},"imageEditor":{"save":"Save!"}}',
    );

    const merged = mergeImageEditorMessages('en', malicious);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(merged.imageEditor.save).toBe('Save!');
  });
});
