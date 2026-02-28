import type { ComponentType } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Check,
  TextQuote,
  ChevronRight,
  FileCode,
  Minus,
  Link,
  Unlink,
  MessageSquare,
  type LucideProps,
} from 'lucide-react';
import type { Editor } from '@tiptap/react';

export type InkioMenuSurface = 'bubble' | 'floating';

export type InkioToolbarActionId =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'highlight'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'callout'
  | 'toggleList'
  | 'codeBlock'
  | 'horizontalRule'
  | 'link'
  | 'unlink'
  | 'comment';

export type InkioIconId = InkioToolbarActionId | 'taskCheck';

export type InkioIconComponent = ComponentType<LucideProps>;

export type InkioIconRegistry = Record<InkioIconId, InkioIconComponent>;

export interface InkioToolbarAction {
  id: InkioToolbarActionId;
  iconId: InkioIconId;
  labelKey: InkioToolbarActionId;
  extensionNames?: string[];
  surfaces: InkioMenuSurface[];
  group: string;
  run: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
  isDisabled?: (editor: Editor) => boolean;
}

export const inkioIconRegistry: InkioIconRegistry = {
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strike: Strikethrough,
  code: Code,
  highlight: Highlighter,
  heading1: Heading1,
  heading2: Heading2,
  heading3: Heading3,
  bulletList: List,
  orderedList: ListOrdered,
  taskList: Check,
  callout: TextQuote,
  toggleList: ChevronRight,
  codeBlock: FileCode,
  horizontalRule: Minus,
  link: Link,
  unlink: Unlink,
  comment: MessageSquare,
  taskCheck: Check,
};

export const inkioToolbarSchema: InkioToolbarAction[] = [
  {
    id: 'bold',
    iconId: 'bold',
    labelKey: 'bold',
    extensionNames: ['bold'],
    surfaces: ['bubble'],
    group: 'text',
    run: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold'),
  },
  {
    id: 'italic',
    iconId: 'italic',
    labelKey: 'italic',
    extensionNames: ['italic'],
    surfaces: ['bubble'],
    group: 'text',
    run: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic'),
  },
  {
    id: 'underline',
    iconId: 'underline',
    labelKey: 'underline',
    extensionNames: ['underline'],
    surfaces: ['bubble'],
    group: 'text',
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor) => editor.isActive('underline'),
  },
  {
    id: 'strike',
    iconId: 'strike',
    labelKey: 'strike',
    extensionNames: ['strike'],
    surfaces: ['bubble'],
    group: 'text',
    run: (editor) => editor.chain().focus().toggleStrike().run(),
    isActive: (editor) => editor.isActive('strike'),
  },
  {
    id: 'code',
    iconId: 'code',
    labelKey: 'code',
    extensionNames: ['code'],
    surfaces: ['bubble'],
    group: 'text-secondary',
    run: (editor) => editor.chain().focus().toggleCode().run(),
    isActive: (editor) => editor.isActive('code'),
  },
  {
    id: 'highlight',
    iconId: 'highlight',
    labelKey: 'highlight',
    extensionNames: ['highlight'],
    surfaces: ['bubble'],
    group: 'text-secondary',
    run: (editor) => editor.chain().focus().toggleHighlight().run(),
    isActive: (editor) => editor.isActive('highlight'),
  },
  {
    id: 'heading1',
    iconId: 'heading1',
    labelKey: 'heading1',
    extensionNames: ['heading'],
    surfaces: ['floating'],
    group: 'heading',
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 1 }),
  },
  {
    id: 'heading2',
    iconId: 'heading2',
    labelKey: 'heading2',
    extensionNames: ['heading'],
    surfaces: ['floating'],
    group: 'heading',
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 2 }),
  },
  {
    id: 'heading3',
    iconId: 'heading3',
    labelKey: 'heading3',
    extensionNames: ['heading'],
    surfaces: ['floating'],
    group: 'heading',
    run: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 3 }),
  },
  {
    id: 'bulletList',
    iconId: 'bulletList',
    labelKey: 'bulletList',
    extensionNames: ['bulletList'],
    surfaces: ['floating'],
    group: 'list',
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList'),
  },
  {
    id: 'orderedList',
    iconId: 'orderedList',
    labelKey: 'orderedList',
    extensionNames: ['orderedList'],
    surfaces: ['floating'],
    group: 'list',
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList'),
  },
  {
    id: 'taskList',
    iconId: 'taskList',
    labelKey: 'taskList',
    extensionNames: ['taskList'],
    surfaces: ['floating'],
    group: 'list',
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
    isActive: (editor) => editor.isActive('taskList'),
  },
  {
    id: 'callout',
    iconId: 'callout',
    labelKey: 'callout',
    extensionNames: ['callout'],
    surfaces: ['floating'],
    group: 'block',
    run: (editor) => (editor.chain().focus() as any).toggleCallout().run(),
    isActive: (editor) => editor.isActive('callout'),
  },
  {
    id: 'toggleList',
    iconId: 'toggleList',
    labelKey: 'toggleList',
    extensionNames: ['toggleListExtension'],
    surfaces: ['floating'],
    group: 'block',
    run: (editor) => {
      const content = {
        type: 'details',
        content: [
          { type: 'detailsSummary' },
          { type: 'detailsContent', content: [{ type: 'paragraph' }] },
        ],
      };
      editor.chain().focus().insertContent(content).run();
    },
    isActive: (editor) => editor.isActive('details'),
  },
  {
    id: 'codeBlock',
    iconId: 'codeBlock',
    labelKey: 'codeBlock',
    extensionNames: ['codeBlock'],
    surfaces: ['floating'],
    group: 'block',
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    isActive: (editor) => editor.isActive('codeBlock'),
  },
  {
    id: 'horizontalRule',
    iconId: 'horizontalRule',
    labelKey: 'horizontalRule',
    extensionNames: ['horizontalRule'],
    surfaces: ['floating'],
    group: 'block',
    run: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },

  {
    id: 'link',
    iconId: 'link',
    labelKey: 'link',
    extensionNames: ['link'],
    surfaces: ['bubble'],
    group: 'insert',
    run: () => {
      // Bubble menu handles link insertion with a dedicated popover.
    },
    isActive: (editor) => editor.isActive('link'),
  },
  {
    id: 'unlink',
    iconId: 'unlink',
    labelKey: 'unlink',
    extensionNames: ['link'],
    surfaces: ['bubble'],
    group: 'insert',
    run: (editor) => editor.chain().focus().unsetLink().run(),
    isActive: (editor) => editor.isActive('link'),
  },
  {
    id: 'comment',
    iconId: 'comment',
    labelKey: 'comment',
    extensionNames: ['comment'],
    surfaces: ['bubble'],
    group: 'insert',
    run: () => {
      // Bubble menu emits a custom event to integrate with external comment UIs.
    },
  },
];

export function resolveIconRegistry(overrides?: Partial<InkioIconRegistry>): InkioIconRegistry {
  return {
    ...inkioIconRegistry,
    ...overrides,
  };
}

export function hasEditorExtension(editor: Editor, name: string): boolean {
  const extensions = editor.extensionManager?.extensions ?? [];
  return extensions.some((extension) => extension.name === name);
}

export function isToolbarActionAvailable(editor: Editor, action: InkioToolbarAction): boolean {
  if (!action.extensionNames || action.extensionNames.length === 0) {
    return true;
  }

  return action.extensionNames.every((name) => hasEditorExtension(editor, name));
}

export function getToolbarActionsFor(editor: Editor, surface: InkioMenuSurface): InkioToolbarAction[] {
  return inkioToolbarSchema.filter(
    (action) => action.surfaces.includes(surface) && isToolbarActionAvailable(editor, action),
  );
}

export function splitToolbarActionGroups(actions: InkioToolbarAction[]): InkioToolbarAction[][] {
  const groups: InkioToolbarAction[][] = [];

  actions.forEach((action) => {
    const current = groups[groups.length - 1];
    if (!current || current[0].group !== action.group) {
      groups.push([action]);
      return;
    }

    current.push(action);
  });

  return groups;
}
