import {
  getToolbarActionsFor,
  inkioIconRegistry,
  inkioToolbarSchema,
  splitToolbarActionGroups,
} from '../registry';

function makeEditor(extensionNames: string[]) {
  return {
    extensionManager: {
      extensions: extensionNames.map((name) => ({ name })),
    },
    isActive: () => false,
    can: () => ({ undo: () => true, redo: () => true }),
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: () => true }),
        toggleItalic: () => ({ run: () => true }),
        toggleUnderline: () => ({ run: () => true }),
        toggleStrike: () => ({ run: () => true }),
        toggleCode: () => ({ run: () => true }),
        toggleHighlight: () => ({ run: () => true }),
        toggleHeading: () => ({ run: () => true }),
        toggleBulletList: () => ({ run: () => true }),
        toggleOrderedList: () => ({ run: () => true }),
        toggleTaskList: () => ({ run: () => true }),
        toggleCallout: () => ({ run: () => true }),
        insertContent: () => ({ run: () => true }),
        toggleCodeBlock: () => ({ run: () => true }),
        setHorizontalRule: () => ({ run: () => true }),
        unsetLink: () => ({ run: () => true }),
      }),
    }),
  } as any;
}

describe('toolbar schema', () => {
  it('maps every action to a valid icon id', () => {
    inkioToolbarSchema.forEach((action) => {
      expect(inkioIconRegistry[action.iconId]).toBeDefined();
    });
  });

  it('keeps action ids unique', () => {
    const ids = inkioToolbarSchema.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('provides actions for bubble and floating surfaces', () => {
    const editor = makeEditor([
      'bold',
      'italic',
      'underline',
      'strike',
      'code',
      'highlight',
      'heading',
      'bulletList',
      'orderedList',
      'taskList',
      'callout',
      'toggleListExtension',
      'codeBlock',
      'horizontalRule',
      'link',
      'comment',
    ]);

    const bubbleIds = getToolbarActionsFor(editor, 'bubble').map((action) => action.id);
    const floatingIds = getToolbarActionsFor(editor, 'floating').map((action) => action.id);

    expect(bubbleIds).toContain('bold');
    expect(floatingIds).toContain('heading1');
    expect(bubbleIds).toContain('link');
  });

  it('splits actions into stable visual groups', () => {
    const editor = makeEditor(['bold', 'italic', 'heading']);
    const groups = splitToolbarActionGroups(getToolbarActionsFor(editor, 'bubble'));

    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].some((action) => action.id === 'bold')).toBe(true);
  });
});
