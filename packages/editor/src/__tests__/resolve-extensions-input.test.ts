import { describe, expect, it } from 'vitest';
import type { EditorProps as CoreEditorProps } from '@inkio/core';
import { resolveExtensionsInput } from '../utils/resolve-extensions-input';

type Extensions = NonNullable<CoreEditorProps['extensions']>;
type Extension = Extensions[number];

function makeExt(name: string): Extension {
  return { name } as unknown as Extension;
}

describe('resolveExtensionsInput', () => {
  const defaults: Extensions = [makeExt('bold'), makeExt('italic')];

  it('returns defaults when input is undefined', () => {
    const result = resolveExtensionsInput(undefined, defaults);
    expect(result).toBe(defaults);
  });

  it('merges array input additively (no overlap)', () => {
    const user: Extensions = [makeExt('mention')];
    const result = resolveExtensionsInput(user, defaults);
    expect(result.map((e: Extension) => e.name)).toEqual(['bold', 'italic', 'mention']);
  });

  it('array input replaces extension with same name', () => {
    const userBold = makeExt('bold');
    const result = resolveExtensionsInput([userBold], defaults);
    expect(result).toHaveLength(2);
    expect(result.find((e: Extension) => e.name === 'bold')).toBe(userBold);
  });

  it('replaces all defaults when object with replace: true', () => {
    const items: Extensions = [makeExt('custom')];
    const result = resolveExtensionsInput({ items, replace: true }, defaults);
    expect(result).toBe(items);
  });

  it('merges when object without replace', () => {
    const items: Extensions = [makeExt('mention')];
    const result = resolveExtensionsInput({ items }, defaults);
    expect(result.map((e: Extension) => e.name)).toEqual(['bold', 'italic', 'mention']);
  });

  it('merges when object with replace: false', () => {
    const items: Extensions = [makeExt('mention')];
    const result = resolveExtensionsInput({ items, replace: false }, defaults);
    expect(result.map((e: Extension) => e.name)).toEqual(['bold', 'italic', 'mention']);
  });
});
