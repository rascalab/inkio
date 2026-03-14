import {
  getToolbarActionsFor,
  splitToolbarActionGroups,
  type InkioToolbarAction,
} from '../../menus/actions';
import {
  defaultBubbleMenuActions,
  defaultFloatingMenuActions,
  defaultToolbarActions,
} from '../../menus/actions';
import { inkioIconRegistry } from '../registry';

function makeEditor(extensionNames: string[]) {
  return {
    extensionManager: {
      extensions: extensionNames.map((name) => ({ name })),
    },
    isActive: () => false,
    can: () => ({
      undo: () => true,
      redo: () => true,
      setTextAlign: () => true,
      toggleSubscript: () => true,
      toggleSuperscript: () => true,
    }),
    getAttributes: () => ({}),
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
        insertTable: () => ({ run: () => true }),
        setDetails: () => ({ run: () => true }),
        unsetDetails: () => ({ run: () => true }),
        setTextAlign: () => ({ run: () => true }),
        toggleSubscript: () => ({ run: () => true }),
        toggleSuperscript: () => ({ run: () => true }),
        setColor: () => ({ run: () => true }),
        unsetColor: () => ({ run: () => true }),
        toggleCodeBlock: () => ({ run: () => true }),
        setHorizontalRule: () => ({ run: () => true }),
        unsetLink: () => ({ run: () => true }),
      }),
    }),
  } as any;
}

describe('toolbar schema', () => {
  it('maps every action to a valid icon id', () => {
    [...defaultBubbleMenuActions, ...defaultFloatingMenuActions, ...defaultToolbarActions].forEach((action) => {
      expect(inkioIconRegistry[action.iconId]).toBeDefined();
    });
  });

  it('keeps action ids unique', () => {
    [defaultBubbleMenuActions, defaultFloatingMenuActions, defaultToolbarActions].forEach((actions) => {
      const ids = actions.map((action) => action.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it('provides actions for bubble, floating, and toolbar surfaces', () => {
    const editor = makeEditor([
      'bold',
      'italic',
      'underline',
      'strike',
      'code',
      'highlight',
      'heading',
      'textStyle',
      'color',
      'textAlign',
      'subscript',
      'superscript',
      'bulletList',
      'orderedList',
      'taskList',
      'callout',
      'table',
      'details',
      'codeBlock',
      'horizontalRule',
      'link',
      'comment',
    ]);

    const bubbleIds = getToolbarActionsFor(editor, 'bubble').map((action) => action.id);
    const floatingIds = getToolbarActionsFor(editor, 'floating').map((action) => action.id);
    const toolbarIds = getToolbarActionsFor(editor, 'toolbar').map((action) => action.id);

    expect(bubbleIds).toContain('bold');
    expect(floatingIds).toContain('heading1');
    expect(floatingIds).toContain('table');
    expect(bubbleIds).toContain('link');
    expect(toolbarIds).toContain('textColor');
    expect(toolbarIds).toContain('textAlignLeft');
    expect(toolbarIds).toContain('subscript');
    expect(toolbarIds).toContain('superscript');
  });

  it('splits actions into stable visual groups', () => {
    const editor = makeEditor(['bold', 'italic', 'heading']);
    const groups = splitToolbarActionGroups(getToolbarActionsFor(editor, 'bubble'));

    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].some((action) => action.id === 'bold')).toBe(true);
  });

  it('supports action transforms per surface', () => {
    const editor = makeEditor(['bold', 'italic']);
    const actions = getToolbarActionsFor(editor, 'bubble', (defaults) =>
      defaults.filter((action) => action.id !== 'italic'),
    );

    expect(actions.map((action) => action.id)).toEqual(['bold']);
  });

  it('keeps custom actions after transform', () => {
    const editor = makeEditor(['bold']);
    const actions = getToolbarActionsFor(editor, 'bubble', (defaults) => [
      ...defaults,
      {
        id: 'custom',
        iconId: 'bold',
        label: 'Custom',
        surfaces: ['bubble'],
        group: 'custom',
        run: () => {},
      } satisfies InkioToolbarAction,
    ]);

    expect(actions.find((action) => action.id === 'custom')).toBeDefined();
  });

  it('does not expose justify alignment in the toolbar schema', () => {
    expect(defaultToolbarActions.map((action) => action.id)).not.toContain('textAlignJustify');
  });

  it('runs toggle list through details commands instead of raw node insertion', () => {
    const setDetails = vi.fn(() => ({ run: () => true }));
    const unsetDetails = vi.fn(() => ({ run: () => true }));
    const editor = {
      extensionManager: {
        extensions: [{ name: 'details' }],
      },
      isActive: vi.fn((name: string) => name === 'details'),
      chain: () => ({
        focus: () => ({
          setDetails,
          unsetDetails,
          run: () => true,
        }),
      }),
    } as any;

    const action = getToolbarActionsFor(editor, 'floating').find((item) => item.id === 'toggleList');
    expect(action).toBeDefined();

    action!.run(editor);

    expect(unsetDetails).toHaveBeenCalledTimes(1);
    expect(setDetails).not.toHaveBeenCalled();
  });

  it('runs table insertion through insertTable when the extension is enabled', () => {
    const insertTable = vi.fn(() => ({ run: () => true }));
    const editor = {
      extensionManager: {
        extensions: [{ name: 'table' }],
      },
      isActive: vi.fn(() => false),
      can: () => ({
        insertTable: () => true,
      }),
      chain: () => ({
        focus: () => ({
          insertTable,
          run: () => true,
        }),
      }),
    } as any;

    const action = getToolbarActionsFor(editor, 'floating').find((item) => item.id === 'table');
    expect(action).toBeDefined();

    action!.run(editor);

    expect(insertTable).toHaveBeenCalledWith({ rows: 3, cols: 3, withHeaderRow: true });
  });
});
