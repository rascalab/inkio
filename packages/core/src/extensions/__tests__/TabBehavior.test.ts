import type { Editor } from '@tiptap/core';
import { getExtensions } from '../get-extensions';

function findTabShortcuts() {
  const extensions = getExtensions({});
  const tabIndent = extensions.find(
    (ext) => typeof ext !== 'string' && (ext as { name?: string }).name === 'tabIndent',
  ) as { config: { addKeyboardShortcuts: () => Record<string, (props: { editor: Editor }) => boolean> } };
  expect(tabIndent).toBeDefined();
  return tabIndent.config.addKeyboardShortcuts();
}

function mockEditor(options: {
  inList: boolean;
  canSink: boolean;
  canLift: boolean;
}) {
  const $from = {
    depth: options.inList ? 2 : 1,
    node: (d: number) => ({
      type: {
        // Depth 1 is the list container for a nested item; depth 0 is doc.
        name: d === 0 ? 'doc' : options.inList && d <= 2 ? (d === 1 ? 'bulletList' : 'listItem') : 'paragraph',
      },
    }),
  };
  const sinkListItem = vi.fn(() => true);
  const liftListItem = vi.fn(() => true);
  const editor = {
    state: { selection: { $from } },
    can: () => ({
      sinkListItem: () => options.canSink,
      liftListItem: () => options.canLift,
    }),
    commands: { sinkListItem, liftListItem },
  } as unknown as Editor;
  return { editor, sinkListItem, liftListItem };
}

describe('tabIndent Tab behavior', () => {
  it('sinks list items when the selection is inside a list', () => {
    const shortcuts = findTabShortcuts();
    const { editor, sinkListItem } = mockEditor({ inList: true, canSink: true, canLift: false });

    expect(shortcuts.Tab({ editor })).toBe(true);
    expect(sinkListItem).toHaveBeenCalledWith('listItem');
  });

  it('lets Tab keep default focus navigation outside lists (no focus trap)', () => {
    const shortcuts = findTabShortcuts();
    const { editor, sinkListItem } = mockEditor({ inList: false, canSink: false, canLift: false });

    expect(shortcuts.Tab({ editor })).toBe(false);
    expect(sinkListItem).not.toHaveBeenCalled();
  });

  it('lets Shift-Tab keep default behavior outside lists', () => {
    const shortcuts = findTabShortcuts();
    const { editor, liftListItem } = mockEditor({ inList: false, canSink: false, canLift: false });

    expect(shortcuts['Shift-Tab']({ editor })).toBe(false);
    expect(liftListItem).not.toHaveBeenCalled();
  });

  it('lifts list items on Shift-Tab inside a list', () => {
    const shortcuts = findTabShortcuts();
    const { editor, liftListItem } = mockEditor({ inList: true, canSink: false, canLift: true });

    expect(shortcuts['Shift-Tab']({ editor })).toBe(true);
    expect(liftListItem).toHaveBeenCalledWith('listItem');
  });

  it('is not registered when tabBehavior is "default"', () => {
    const extensions = getExtensions({ tabBehavior: 'default' });
    expect(
      extensions.some(
        (ext) => typeof ext !== 'string' && (ext as { name?: string }).name === 'tabIndent',
      ),
    ).toBe(false);
  });
});
