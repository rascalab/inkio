import { render } from '@testing-library/react';
import { BubbleMenu } from '../BubbleMenu/BubbleMenu';

describe('BubbleMenu component', () => {
  it('should render null when editor is null', () => {
    const { container } = render(<BubbleMenu editor={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('should always render DOM when editor is provided (visibility pattern)', () => {
    const mockEditor = {
      state: {
        selection: { from: 0, to: 0, empty: true },
      },
      view: {
        coordsAtPos: () => ({ top: 0, left: 0 }),
        dom: {
          getBoundingClientRect: () => ({ top: 0, left: 0, width: 500 }),
        },
      },
      on: vi.fn(),
      off: vi.fn(),
      isActive: () => false,
      getAttributes: () => ({}),
      chain: () => ({
        focus: () => ({
          toggleBold: () => ({ run: () => { } }),
          run: () => { },
        }),
      }),
    } as any;

    const { container } = render(<BubbleMenu editor={mockEditor} />);
    // Should render the menu div even when not visible (visibility: hidden)
    const menuDiv = container.firstChild as HTMLElement;
    expect(menuDiv).not.toBeNull();
    expect(menuDiv.className).toContain('inkio-floating-overlay');
    expect(menuDiv.className).not.toContain('is-visible');
  });
});
