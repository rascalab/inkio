// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LOCALE } from '../../constants';
import { EditorToolbar } from '../EditorToolbar';

afterEach(cleanup);

describe('EditorToolbar keyboard navigation', () => {
  it('moves focus through the vertical tools without changing the active tool', () => {
    const onToolChange = vi.fn();
    render(
      <EditorToolbar
        activeTool="resize"
        enabledTools={['resize', 'draw', 'rotate']}
        locale={DEFAULT_LOCALE}
        onToolChange={onToolChange}
      />,
    );
    const resize = screen.getByRole('button', { name: DEFAULT_LOCALE.resize });
    const draw = screen.getByRole('button', { name: DEFAULT_LOCALE.draw });
    const rotate = screen.getByRole('button', { name: DEFAULT_LOCALE.rotate });
    resize.focus();

    fireEvent.keyDown(resize, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(draw);
    fireEvent.keyDown(draw, { key: 'End' });
    expect(document.activeElement).toBe(rotate);
    fireEvent.keyDown(rotate, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(resize);
    fireEvent.keyDown(resize, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(rotate);
    fireEvent.keyDown(rotate, { key: 'Home' });
    expect(document.activeElement).toBe(resize);
    expect(onToolChange).not.toHaveBeenCalled();
  });
});
