import { useRef } from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useDismissableLayer,
  type UseDismissableLayerOptions,
} from '../use-dismissable-layer';

type HarnessProps = Omit<UseDismissableLayerOptions, 'refs'> & { withTrigger?: boolean };

function Harness({ withTrigger = false, ...options }: HarnessProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useDismissableLayer({
    ...options,
    refs: withTrigger ? [layerRef, triggerRef] : [layerRef],
  });
  return (
    <div>
      <button ref={triggerRef} data-testid="trigger">trigger</button>
      <div ref={layerRef} data-testid="layer">
        <input data-testid="inner" />
      </div>
      <div data-testid="outside">outside</div>
    </div>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useDismissableLayer', () => {
  it('dismisses on outside mousedown but not inside', () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<Harness onDismiss={onDismiss} />);

    fireEvent.mouseDown(getByTestId('inner'));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.mouseDown(getByTestId('outside'));
    expect(onDismiss).toHaveBeenCalledWith('outside', expect.any(MouseEvent));
  });

  it('treats every ref as inside', () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<Harness withTrigger onDismiss={onDismiss} />);
    fireEvent.mouseDown(getByTestId('trigger'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('arms the outside listener only after armDelayMs', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { getByTestId } = render(<Harness onDismiss={onDismiss} armDelayMs={100} />);

    fireEvent.mouseDown(getByTestId('outside'));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.mouseDown(getByTestId('outside'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('arms Escape immediately even with an arm delay', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} armDelayMs={100} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledWith('escape', expect.any(KeyboardEvent));
  });

  it('ignores Escape while an IME composition is active', () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: 'Escape', isComposing: true });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('honours escape: false', () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} escape={false} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('supports insideOnly + stopPropagation escape options', () => {
    const onDismiss = vi.fn();
    const outerKeydown = vi.fn();
    window.addEventListener('keydown', outerKeydown);
    const { getByTestId } = render(
      <Harness onDismiss={onDismiss} escape={{ insideOnly: true, stopPropagation: true }} />,
    );

    fireEvent.keyDown(getByTestId('outside'), { key: 'Escape' });
    expect(onDismiss).not.toHaveBeenCalled();
    expect(outerKeydown).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(getByTestId('inner'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(outerKeydown).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', outerKeydown);
  });

  it('uses capture-phase listeners when capture is set', () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<Harness onDismiss={onDismiss} capture />);
    const outside = getByTestId('outside');
    outside.addEventListener('mousedown', (event) => event.stopPropagation());
    fireEvent.mouseDown(outside);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('attaches nothing while disabled and cleans up on unmount', () => {
    const onDismiss = vi.fn();
    const { getByTestId, rerender, unmount } = render(
      <Harness onDismiss={onDismiss} enabled={false} />,
    );
    fireEvent.mouseDown(getByTestId('outside'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).not.toHaveBeenCalled();

    rerender(<Harness onDismiss={onDismiss} enabled />);
    fireEvent.mouseDown(getByTestId('outside'));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.mouseDown(document.body);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('always calls the latest onDismiss without re-arming', () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    const { getByTestId, rerender } = render(<Harness onDismiss={first} armDelayMs={100} />);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender(<Harness onDismiss={second} armDelayMs={100} />);
    fireEvent.mouseDown(getByTestId('outside'));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
