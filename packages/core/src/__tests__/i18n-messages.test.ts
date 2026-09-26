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

describe('i18n Korean messageset', () => {
  it('resolves ko to Korean strings', () => {
    const resolved = resolveCoreMessages('ko');
    expect(resolved.actions.undo).toBe('실행 취소');
    expect(resolved.tableMenu.deleteTable).toBe('표 삭제');
    expect(resolved.blockHandle.delete).toBe('삭제');
  });

  it('falls back to en for unknown locales', () => {
    const resolved = resolveCoreMessages('xx-YY');
    expect(resolved.actions.undo).toBe('Undo');
  });

  it('ko accepts overrides on top', () => {
    const resolved = resolveCoreMessages('ko', { actions: { undo: '되돌리기' } });
    expect(resolved.actions.undo).toBe('되돌리기');
    expect(resolved.actions.redo).toBe('다시 실행');
  });
});
