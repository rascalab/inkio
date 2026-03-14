// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextAnnotationShape } from '../TextAnnotationShape';

vi.mock('react-konva', () => ({
  Group: ({ children, onClick, onDblClick }: any) => (
    <div data-testid="text-annotation-group" onClick={onClick} onDoubleClick={onDblClick}>
      {children}
    </div>
  ),
  Rect: () => <div />,
  Text: () => <div />,
}));

afterEach(() => {
  cleanup();
});

describe('TextAnnotationShape', () => {
  const annotation = {
    id: 'text-1',
    type: 'text' as const,
    x: 40,
    y: 50,
    text: 'Inkio',
    fontSize: 24,
    fill: '#111827',
    fontStyle: 'normal',
    width: 160,
    rotation: 0,
  };

  it('single click only selects the text annotation', () => {
    const onSelect = vi.fn();
    const onStartEdit = vi.fn();

    render(
      <TextAnnotationShape
        annotation={annotation}
        onSelect={onSelect}
        onStartEdit={onStartEdit}
        onChange={vi.fn()}
        isEditing={false}
        scale={1}
      />,
    );

    fireEvent.click(screen.getByTestId('text-annotation-group'));

    expect(onSelect).toHaveBeenCalledWith('text-1');
    expect(onStartEdit).not.toHaveBeenCalled();
  });

  it('double click enters text editing mode', () => {
    const onSelect = vi.fn();
    const onStartEdit = vi.fn();

    render(
      <TextAnnotationShape
        annotation={annotation}
        onSelect={onSelect}
        onStartEdit={onStartEdit}
        onChange={vi.fn()}
        isEditing={false}
        scale={1}
      />,
    );

    fireEvent.doubleClick(screen.getByTestId('text-annotation-group'));

    expect(onSelect).toHaveBeenCalledWith('text-1');
    expect(onStartEdit).toHaveBeenCalledWith('text-1');
  });
});
