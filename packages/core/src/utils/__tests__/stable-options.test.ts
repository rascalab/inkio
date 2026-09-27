import { renderHook } from '@testing-library/react';
import { isEqualOptionsValue, useStableCallback, useStableOptions, useStableProps } from '../stable-options';
import { mapEditorUiToCoreProps, mergeImageBlockOptions } from '../editor-wrapper';

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

describe('useStableProps', () => {
  type Props = { label?: string; config?: { size: number }; onPick?: () => string };

  it('keeps object identity across structurally equal inline props', () => {
    const { result, rerender } = renderHook((props: Props) => useStableProps(props), {
      initialProps: { label: 'a', config: { size: 1 }, onPick: () => 'first' } as Props,
    });
    const first = result.current;
    rerender({ label: 'a', config: { size: 1 }, onPick: () => 'second' });
    expect(result.current).toBe(first);
    expect(result.current.config).toBe(first.config);
    // Callbacks forward to the newest implementation.
    expect(result.current.onPick?.()).toBe('second');
  });

  it('changes identity only for real changes, keeping unchanged fields', () => {
    const { result, rerender } = renderHook((props: Props) => useStableProps(props), {
      initialProps: { label: 'a', config: { size: 1 }, onPick: () => 'x' } as Props,
    });
    const first = result.current;
    rerender({ label: 'b', config: { size: 1 }, onPick: () => 'x' });
    expect(result.current).not.toBe(first);
    expect(result.current.label).toBe('b');
    expect(result.current.config).toBe(first.config);
    expect(result.current.onPick).toBe(first.onPick);
  });

  it('tracks callback defined-ness like useStableCallback', () => {
    const { result, rerender } = renderHook((props: Props) => useStableProps(props), {
      initialProps: { onPick: undefined } as Props,
    });
    expect(result.current.onPick).toBeUndefined();
    rerender({ onPick: () => 'now' });
    const forwarder = result.current.onPick;
    expect(forwarder?.()).toBe('now');
    rerender({ onPick: undefined });
    expect(result.current.onPick).toBeUndefined();
    rerender({ onPick: () => 'again' });
    expect(result.current.onPick).not.toBe(forwarder);
    expect(result.current.onPick?.()).toBe('again');
  });
});

describe('editor wrapper mappers', () => {
  it('applies visibility defaults only when ui leaves them unset', () => {
    const defaults = { showToolbar: true, showBubbleMenu: false, showFloatingMenu: false, showTableMenu: true };
    expect(mapEditorUiToCoreProps(undefined, defaults)).toMatchObject(defaults);
    expect(mapEditorUiToCoreProps({ showToolbar: false, className: 'x' }, defaults)).toMatchObject({
      ...defaults,
      showToolbar: false,
      className: 'x',
    });
  });

  it('merges upload/error handlers into image block options', () => {
    const onUpload = async () => 'src';
    const onError = () => {};
    expect(mergeImageBlockOptions(undefined, {})).toBeUndefined();
    expect(mergeImageBlockOptions({ maxFileSize: 5 }, {})).toEqual({ maxFileSize: 5 });
    expect(mergeImageBlockOptions({ maxFileSize: 5 }, { onUpload, onError })).toEqual({
      maxFileSize: 5,
      onUpload,
      onError,
    });
    expect(mergeImageBlockOptions(undefined, { onUpload })).toEqual({ onUpload });
  });
});
