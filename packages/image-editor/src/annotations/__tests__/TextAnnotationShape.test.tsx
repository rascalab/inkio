// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextAnnotationShape } from '../TextAnnotationShape';

vi.mock('react-konva', () => ({
  Group: ({ children, onClick }: any) => (
    <div data-testid="text-annotation-group" onClick={onClick}>
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
    fontSize: 32,
    fontFamily: 'system-ui',
    fill: '#111827',
    fontStyle: 'normal' as const,
    width: 160,
    rotation: 0,
  };

  it('single click only selects the text annotation', () => {
    const onSelect = vi.fn();

    render(
      <TextAnnotationShape
        annotation={annotation}
        onSelect={onSelect}
        onChange={vi.fn()}
        scale={1}
      />,
    );

    fireEvent.click(screen.getByTestId('text-annotation-group'));

    expect(onSelect).toHaveBeenCalledWith('text-1');
  });
});
