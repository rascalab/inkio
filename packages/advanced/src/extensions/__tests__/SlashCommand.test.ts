import { Editor, Extension, type Range } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { SlashCommand, SlashCommandItem, defaultSlashCommands, filterSlashCommandItems } from '../SlashCommand';

function createMockEditor(commandNames: string[] = [], schemaNodes: string[] = []) {
  const chain = {
    focus: vi.fn(() => chain),
    deleteRange: vi.fn(() => chain),
    run: vi.fn(() => true),
  } as Record<string, any>;

  commandNames.forEach((commandName) => {
    chain[commandName] = vi.fn(() => chain);
  });

  const nodes = schemaNodes.reduce<Record<string, {}>>((acc, name) => {
    acc[name] = {};
    return acc;
  }, { paragraph: {} });

  const editor = {
    state: {
      schema: {
        nodes,
      },
    },
    chain: vi.fn(() => chain),
    commands: {},
    isDestroyed: false,
  } as unknown as Editor;

  return { editor, chain };
}

const range: Range = {
  from: 2,
  to: 4,
};

describe('SlashCommand extension', () => {
  it('should have correct name', () => {
    expect(SlashCommand.name).toBe('slashCommand');
  });

  it('SlashCommandItem icon field should accept ReactNode type', () => {
    const item: SlashCommandItem = {
      id: 'test',
      label: 'Test',
      icon: undefined, // ReactNode allows undefined
      command: () => {},
    };
    expect(item.icon).toBeUndefined();
  });

  it('should export defaultSlashCommands', async () => {
    expect(defaultSlashCommands.length).toBeGreaterThan(0);
    expect(defaultSlashCommands[0]).toHaveProperty('id');
    expect(defaultSlashCommands[0]).toHaveProperty('label');
    expect(defaultSlashCommands[0]).toHaveProperty('command');
  });

  it('runs slash commands through the optional chain helper when the command exists', () => {
    const bulletList = defaultSlashCommands.find((item) => item.id === 'bulletList');
    expect(bulletList).toBeDefined();

    const { editor, chain } = createMockEditor(['toggleBulletList']);

    bulletList!.command({ editor, range });

    expect(chain.focus).toHaveBeenCalledTimes(1);
    expect(chain.deleteRange).toHaveBeenCalledWith(range);
    expect(chain.toggleBulletList).toHaveBeenCalledTimes(1);
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('does not throw or run when the target command is unavailable', () => {
    const horizontalRule = defaultSlashCommands.find((item) => item.id === 'horizontalRule');
    expect(horizontalRule).toBeDefined();

    const { editor, chain } = createMockEditor();

    expect(() => horizontalRule!.command({ editor, range })).not.toThrow();
    expect(chain.deleteRange).toHaveBeenCalledWith(range);
    expect(chain.run).not.toHaveBeenCalled();
  });

  it('allows transforming default slash command items', async () => {
    const transformItems = vi.fn((defaults: SlashCommandItem[]) =>
      defaults.filter((item) => item.id !== 'image'),
    );
    const options = SlashCommand.config.addOptions?.call({
      parent: () => ({
        suggestion: {},
        items: undefined,
        transformItems,
        onError: undefined,
      }),
    } as any);

    expect(options).toBeDefined();
  });

  it('toggle list slash command uses details commands when available', () => {
    const toggleList = defaultSlashCommands.find((item) => item.id === 'toggleList');
    expect(toggleList).toBeDefined();

    const { editor, chain } = createMockEditor(['setDetails'], ['details']);

    toggleList!.command({ editor, range });

    expect(chain.deleteRange).toHaveBeenCalledWith(range);
    expect(chain.setDetails).toHaveBeenCalledTimes(1);
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('toggle list slash command is a safe no-op without details nodes', () => {
    const toggleList = defaultSlashCommands.find((item) => item.id === 'toggleList');
    expect(toggleList).toBeDefined();

    const { editor, chain } = createMockEditor();

    expect(() => toggleList!.command({ editor, range })).not.toThrow();
    expect(chain.run).not.toHaveBeenCalled();
  });

  it('table slash command inserts the default 3x3 table through insertTable', () => {
    const table = defaultSlashCommands.find((item) => item.id === 'table');
    expect(table).toBeDefined();

    const { editor, chain } = createMockEditor(['insertTable'], ['table']);

    table!.command({ editor, range });

    expect(chain.deleteRange).toHaveBeenCalledWith(range);
    expect(chain.insertTable).toHaveBeenCalledWith({ rows: 3, cols: 3, withHeaderRow: true });
    expect(chain.run).toHaveBeenCalledTimes(1);
  });

  it('table slash command is a safe no-op without the table extension', () => {
    const table = defaultSlashCommands.find((item) => item.id === 'table');
    expect(table).toBeDefined();

    const { editor, chain } = createMockEditor();

    expect(() => table!.command({ editor, range })).not.toThrow();
    expect(chain.run).not.toHaveBeenCalled();
  });

  describe('image file chooser', () => {
    let editor: Editor;
    let input: HTMLInputElement;
    const upload = vi.fn<(files: File[], pos?: number) => boolean>(() => true);
    const slash = { from: 1, to: 7 };

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) { input = this; });
      editor = new Editor({
        element: document.createElement('div'),
        extensions: [Document, Paragraph, Text, Extension.create({
          name: 'imageUploadTest',
          addCommands: () => ({ uploadImageBlock: (files: File[], pos?: number) => () => upload(files, pos) }),
        })],
        content: '<p>/image</p>',
      });
      defaultSlashCommands.find((item) => item.id === 'image')!.command({ editor, range: slash });
    });

    afterEach(() => {
      editor.destroy();
      upload.mockClear();
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    function chooseFile() {
      const file = new File(['image'], 'demo.png', { type: 'image/png' });
      Object.defineProperty(input, 'files', { value: [file] });
      input.dispatchEvent(new Event('change'));
      vi.advanceTimersToNextFrame();
    }

    it('uploads at the slash range even when an earlier block was inserted', () => {
      editor.commands.insertContentAt(0, { type: 'paragraph' });
      chooseFile();
      expect(editor.getText().trim()).toBe('');
      expect(upload).toHaveBeenCalledWith(expect.any(Array), 3);
    });

    it('never deletes replacement text when the original trigger was removed', () => {
      editor.commands.setContent('<p>Replaced</p>');
      chooseFile();
      expect(editor.getText()).toBe('Replaced');
      expect(upload).not.toHaveBeenCalled();
    });

    it('leaves a document made read-only during file selection alone', () => {
      editor.setEditable(false);
      chooseFile();
      expect(editor.getText()).toBe('/image');
      expect(upload).not.toHaveBeenCalled();
    });
  });
});

describe('slash command search', () => {
  const items = [{ id: 'heading1', label: '제목 1', command: () => {} }, { id: 'table', label: '표', command: () => {} }];
  const labels = (query: string) =>
    filterSlashCommandItems(items as SlashCommandItem[], query, {} as Editor).map((item) => item.label);

  it('finds a label with or without its space', () => {
    expect(labels('제목 1')).toEqual(['제목 1']);
    expect(labels('제목1')).toEqual(['제목 1']);
    expect(labels('제목 ')).toEqual(['제목 1']);
  });

  it('matches nothing for a sentence', () => {
    expect(labels('표는 이렇게')).toEqual([]);
  });
});
