import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { Toolbar } from '../Toolbar';

function createEditor(extensionNames: string[]) {
  let currentColor = '#111827';
  const setColor = vi.fn((value: string) => {
    currentColor = value;
    return { run: () => true };
  });
  const unsetColor = vi.fn(() => {
    currentColor = '';
    return { run: () => true };
  });

  return {
    editor: {
      extensionManager: {
        extensions: extensionNames.map((name) => ({ name })),
      },
      state: {
        selection: { from: 1, to: 2, empty: false },
      },
      view: {
        coordsAtPos: () => ({ top: 0, left: 0, right: 16, bottom: 16 }),
        dom: {
          getBoundingClientRect: () => ({ top: 0, left: 0, right: 640, bottom: 480, width: 640, height: 480 }),
        },
      },
      on: vi.fn(),
      off: vi.fn(),
      isActive: vi.fn(() => false),
      can: vi.fn(() => ({ undo: () => true, redo: () => true })),
      getAttributes: vi.fn((name: string) => (name === 'textStyle' ? { color: currentColor } : {})),
      chain: vi.fn(() => ({
        focus: () => ({
          toggleBold: () => ({ run: () => true }),
          toggleItalic: () => ({ run: () => true }),
          setColor,
          unsetColor,
          run: () => true,
        }),
      })),
      commands: {},
    } as any,
    spies: {
      setColor,
      unsetColor,
      getCurrentColor: () => currentColor,
    },
  };
}

describe('Toolbar', () => {
  it('renders when enabled and respects item transforms', async () => {
    const { editor } = createEditor(['bold', 'italic']);

    await act(async () => {
      render(
        <Toolbar
          editor={editor}
          items={(defaults) => defaults.filter((action) => action.id === 'bold')}
        />,
      );
    });

    expect(screen.getByRole('toolbar', { name: 'Editor toolbar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Italic' })).toBeNull();
  });

  it('applies and clears text color from the built-in popover', async () => {
    const { editor, spies } = createEditor(['color']);

    await act(async () => {
      render(
        <Toolbar
          editor={editor}
          items={(defaults) => defaults.filter((action) => action.id === 'textColor')}
        />,
      );
    });

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('button', { name: 'Text color' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Text color: #ef4444' }));
    expect(spies.setColor).toHaveBeenCalledWith('#ef4444');
    expect(spies.getCurrentColor()).toBe('#ef4444');

    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('button', { name: 'Text color' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Text color: clear' }));
    expect(spies.unsetColor).toHaveBeenCalledTimes(1);
    expect(spies.getCurrentColor()).toBe('');
  });
});
