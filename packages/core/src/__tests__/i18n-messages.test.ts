import { describe, it, expect } from 'vitest';
import { mergeCoreMessages, resolveCoreMessages } from '../i18n/messages';

// Guards the prototype-pollution fix in deepMerge: magic keys from
// consumer-supplied overrides (e.g. parsed JSON) must never be merged.
describe('i18n deepMerge prototype guard', () => {
  it('ignores __proto__ / constructor / prototype keys', () => {
    const malicious = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"polluted":true},"prototype":{"polluted":true},"actions":{"undo":"Undo!","__proto__":{"polluted":true}}}',
    );

    const merged = mergeCoreMessages('en', malicious);

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    // Legit keys still merge.
    expect(merged.actions.undo).toBe('Undo!');
    expect(merged.actions.redo).toBe('Redo');
  });

  it('resolveCoreMessages ignores magic keys', () => {
    const malicious = JSON.parse('{"__proto__":{"x":1}}');
    const resolved = resolveCoreMessages('en', malicious);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(resolved.actions.undo).toBe('Undo');
  });
});
