import { describe, expect, it } from 'vitest';
import type { EditorProps as CoreEditorProps } from '@inkio/core';
import { mergeExtensions } from '../utils/merge-extensions';

type Extensions = NonNullable<CoreEditorProps['extensions']>;
type Extension = Extensions[number];

function makeExt(name: string): Extension {
  return { name } as unknown as Extension;
}

describe('mergeExtensions', () => {
  it('returns defaults when user array is empty', () => {
    const defaults = [makeExt('bold'), makeExt('italic')];
    const result = mergeExtensions(defaults, []);
    expect(result).toBe(defaults);
  });

  it('appends user extensions to defaults (no overlap)', () => {
    const defaults = [makeExt('bold'), makeExt('italic')];
    const user = [makeExt('mention')];
    const result = mergeExtensions(defaults, user);
    expect(result.map((e: Extension) => e.name)).toEqual(['bold', 'italic', 'mention']);
  });

  it('replaces default extension when user provides same name', () => {
    const defaultBold = makeExt('bold');
    const userBold = makeExt('bold');
    const defaults = [defaultBold, makeExt('italic')];
    const result = mergeExtensions(defaults, [userBold]);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('italic');
    expect(result[1]).toBe(userBold);
  });

  it('replaces multiple default extensions and preserves order (user extensions last)', () => {
    const defaults = [makeExt('a'), makeExt('b'), makeExt('c')];
    const user = [makeExt('b'), makeExt('d')];
    const result = mergeExtensions(defaults, user);
    expect(result.map((e: Extension) => e.name)).toEqual(['a', 'c', 'b', 'd']);
  });
});
