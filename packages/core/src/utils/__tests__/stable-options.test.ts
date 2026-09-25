import { renderHook } from '@testing-library/react';
import { isEqualOptionsValue, useStableCallback, useStableOptions } from '../stable-options';

describe('useStableCallback', () => {
  it('keeps one identity across inline closures while forwarding to the newest', () => {
    const { result, rerender } = renderHook(({ tag }) => useStableCallback(() => tag), {
      initialProps: { tag: 'a' },
    });
    const first = result.current;
    rerender({ tag: 'b' });
    expect(result.current).toBe(first);
    expect(result.current?.()).toBe('b');
  });

  it('tracks defined-ness: undefined in, undefined out', () => {
    const { result, rerender } = renderHook(
      ({ fn }: { fn?: () => string }) => useStableCallback(fn),
      { initialProps: { fn: undefined as (() => string) | undefined } },
    );
    expect(result.current).toBeUndefined();
    rerender({ fn: () => 'x' });
    expect(result.current?.()).toBe('x');
    rerender({ fn: undefined });
    expect(result.current).toBeUndefined();
  });
});

describe('isEqualOptionsValue', () => {
  it('compares primitives and references', () => {
    expect(isEqualOptionsValue(undefined, undefined)).toBe(true);
    expect(isEqualOptionsValue({ a: 1 }, { a: 1 })).toBe(true);
    expect(isEqualOptionsValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(isEqualOptionsValue({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('compares functions by reference only', () => {
    const fn = () => {};
    expect(isEqualOptionsValue({ onUpload: fn }, { onUpload: fn })).toBe(true);
    expect(isEqualOptionsValue({ onUpload: () => {} }, { onUpload: () => {} })).toBe(false);
  });

  it('compares nested objects structurally', () => {
    expect(isEqualOptionsValue({ ui: { showToolbar: true } }, { ui: { showToolbar: true } })).toBe(true);
    expect(isEqualOptionsValue({ ui: { showToolbar: true } }, { ui: { showToolbar: false } })).toBe(false);
  });
});

describe('useStableOptions', () => {
  it('keeps identity for structurally equal inline literals', () => {
    const { result, rerender } = renderHook(({ value }) => useStableOptions(value), {
      initialProps: { value: { showToolbar: false } as { showToolbar: boolean; extra?: number } },
    });
    const first = result.current;
    rerender({ value: { showToolbar: false } });
    expect(result.current).toBe(first);
  });

  it('propagates real changes and new callbacks', () => {
    const fnA = () => {};
    const fnB = () => {};
    const { result, rerender } = renderHook(({ value }) => useStableOptions(value), {
      initialProps: { value: { onUpload: fnA } as { onUpload: () => void; extra?: number } },
    });
    const first = result.current;
    rerender({ value: { onUpload: fnA } });
    expect(result.current).toBe(first);
    rerender({ value: { onUpload: fnB } });
    expect(result.current).not.toBe(first);
    expect(result.current.onUpload).toBe(fnB);
    rerender({ value: { onUpload: fnB, extra: 1 } });
    expect(result.current.onUpload).toBe(fnB);
  });
});
