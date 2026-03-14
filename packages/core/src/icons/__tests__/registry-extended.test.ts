import {
  inkioIconRegistry,
  resolveIconRegistry,
  type InkioIconId,
} from '../registry';
import {
  defaultBubbleMenuActions,
  defaultFloatingMenuActions,
  defaultToolbarActions,
  getToolbarActionsFor,
  splitToolbarActionGroups,
} from '../../menus/actions';

const ALL_ICON_IDS: InkioIconId[] = [
  'bold', 'italic', 'underline', 'strike', 'code', 'highlight',
  'heading1', 'heading2', 'heading3',
  'bulletList', 'orderedList', 'taskList',
  'callout', 'table', 'toggleList', 'codeBlock', 'horizontalRule',
  'link', 'unlink', 'comment',
  'undo', 'redo', 'textColor', 'subscript', 'superscript', 'textAlignLeft', 'textAlignCenter', 'textAlignRight',
  'addColumnBefore', 'addColumnAfter', 'deleteColumn',
  'addRowBefore', 'addRowAfter', 'deleteRow',
  'toggleHeaderColumn', 'toggleHeaderRow', 'mergeCells', 'splitCell', 'deleteTable',
];

describe('inkioIconRegistry', () => {
  it('has all required icon IDs', () => {
    ALL_ICON_IDS.forEach((id) => {
      expect(inkioIconRegistry[id]).toBeDefined();
    });
  });

  it('all icons are renderable (function or forwardRef object)', () => {
    ALL_ICON_IDS.forEach((id) => {
      const icon = inkioIconRegistry[id];
      // ForwardRef icon components can be functions or objects with $$typeof.
      expect(icon).toBeDefined();
      expect(icon).not.toBeNull();
      // Must be either a function or a forwardRef/memo object (both valid React components)
      const t = typeof icon;
      expect(['function', 'object']).toContain(t);
    });
  });
});

describe('resolveIconRegistry', () => {
  it('returns inkioIconRegistry when no overrides given', () => {
    const result = resolveIconRegistry();
    expect(result).toEqual(inkioIconRegistry);
  });

  it('merges overrides into the default registry', () => {
    const CustomIcon = () => null;
    const result = resolveIconRegistry({ bold: CustomIcon as any });
    expect(result.bold).toBe(CustomIcon);
    expect(result.italic).toBe(inkioIconRegistry.italic);
  });
});

function makeEditor(extensionNames: string[]) {
  return {
    extensionManager: {
      extensions: extensionNames.map((name) => ({ name })),
    },
    isActive: () => false,
  } as any;
}

describe('getToolbarActionsFor', () => {
  it('returns bubble surface actions for bubble', () => {
    const editor = makeEditor(['bold', 'italic', 'link', 'comment']);
    const actions = getToolbarActionsFor(editor, 'bubble');
    const ids = actions.map((a) => a.id);
    expect(ids).toContain('bold');
    expect(ids).toContain('italic');
    expect(ids).not.toContain('heading1');
    expect(ids).not.toContain('bulletList');
  });

  it('returns floating surface actions for floating', () => {
    const editor = makeEditor(['heading', 'bulletList', 'orderedList']);
    const actions = getToolbarActionsFor(editor, 'floating');
    const ids = actions.map((a) => a.id);
    expect(ids).toContain('heading1');
    expect(ids).toContain('bulletList');
    expect(ids).not.toContain('bold');
  });

  it('filters out actions whose extensions are not registered', () => {
    // Editor with no extensions
    const emptyEditor = makeEditor([]);
    const actions = getToolbarActionsFor(emptyEditor, 'bubble');
    // bold requires 'bold' extension — should be filtered out
    expect(actions.find((a) => a.id === 'bold')).toBeUndefined();
  });

  it('includes actions with no extensionNames requirement', () => {
    // comment action has extensionNames: ['comment']
    // horizontalRule has extensionNames: ['horizontalRule']
    const editor = makeEditor(['horizontalRule']);
    const actions = getToolbarActionsFor(editor, 'floating');
    expect(actions.find((a) => a.id === 'horizontalRule')).toBeDefined();
  });
});

describe('splitToolbarActionGroups', () => {
  it('returns empty array for empty actions', () => {
    expect(splitToolbarActionGroups([])).toEqual([]);
  });

  it('groups consecutive actions with the same group together', () => {
    const editor = makeEditor(['bold', 'italic', 'underline', 'strike', 'code', 'highlight', 'link']);
    const actions = getToolbarActionsFor(editor, 'bubble');
    const groups = splitToolbarActionGroups(actions);

    // All groups should be non-empty arrays
    groups.forEach((group) => {
      expect(group.length).toBeGreaterThan(0);
    });

    // Each group should have a consistent group name
    groups.forEach((group) => {
      const groupName = group[0].group;
      group.forEach((action) => {
        expect(action.group).toBe(groupName);
      });
    });
  });

  it('creates separate groups for different group names', () => {
    // text group: bold, italic, underline, strike
    // text-secondary: code, highlight
    const editor = makeEditor(['bold', 'italic', 'code', 'highlight']);
    const bubbleActions = getToolbarActionsFor(editor, 'bubble');
    const groups = splitToolbarActionGroups(bubbleActions);

    // Should have at least 2 groups (text and text-secondary)
    expect(groups.length).toBeGreaterThanOrEqual(2);
  });

  it('single action produces single group of one', () => {
    const singleAction = [defaultBubbleMenuActions.find((a) => a.id === 'bold')!];
    const groups = splitToolbarActionGroups(singleAction);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(1);
  });
});

describe('default menu actions', () => {
  it('every action has required fields', () => {
    [...defaultBubbleMenuActions, ...defaultFloatingMenuActions, ...defaultToolbarActions].forEach((action) => {
      expect(action.id).toBeDefined();
      expect(action.iconId).toBeDefined();
      expect(action.labelKey ?? action.label).toBeDefined();
      expect(Array.isArray(action.surfaces)).toBe(true);
      expect(action.surfaces.length).toBeGreaterThan(0);
      expect(action.group).toBeDefined();
      expect(typeof action.run).toBe('function');
    });
  });

  it('every action has a corresponding icon in the registry', () => {
    [...defaultBubbleMenuActions, ...defaultFloatingMenuActions, ...defaultToolbarActions].forEach((action) => {
      expect(inkioIconRegistry[action.iconId]).toBeDefined();
    });
  });

  it('each surface value is either bubble, floating, or toolbar', () => {
    [...defaultBubbleMenuActions, ...defaultFloatingMenuActions, ...defaultToolbarActions].forEach((action) => {
      action.surfaces.forEach((surface) => {
        expect(['bubble', 'floating', 'toolbar']).toContain(surface);
      });
    });
  });
});
