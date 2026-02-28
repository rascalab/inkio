import { render } from '@testing-library/react';
import { FloatingMenu } from '../FloatingMenu/FloatingMenu';

describe('FloatingMenu component', () => {
  it('should render null when editor is null', () => {
    const { container } = render(<FloatingMenu editor={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('should always render DOM when editor is provided (visibility pattern)', () => {
    const mockEditor = {
      state: {
        selection: { from: 0, empty: true },
        doc: {
          resolve: () => ({
            parent: { type: { name: 'paragraph' }, textContent: '' },
          }),
        },
      },
      view: {
        coordsAtPos: () => ({ top: 100, left: 50 }),
        dom: {
          getBoundingClientRect: () => ({ top: 0, left: 0, width: 500 }),
        },
      },
      on: vi.fn(),
      off: vi.fn(),
      isActive: () => false,
      chain: () => ({
        focus: () => ({
          toggleHeading: () => ({ run: () => { } }),
          toggleBulletList: () => ({ run: () => { } }),
          toggleOrderedList: () => ({ run: () => { } }),
          toggleTaskList: () => ({ run: () => { } }),
          toggleCallout: () => ({ run: () => { } }),
          toggleCodeBlock: () => ({ run: () => { } }),
          setHorizontalRule: () => ({ run: () => { } }),
        }),
      }),
    } as any;

    const { container } = render(<FloatingMenu editor={mockEditor} />);
    // Should render the menu div even when not visible (visibility: hidden)
    const menuDiv = container.firstChild as HTMLElement;
    expect(menuDiv).not.toBeNull();
    expect(menuDiv.className).toContain('inkio-floating-overlay');
    expect(menuDiv.className).not.toContain('is-visible');
  });
});
