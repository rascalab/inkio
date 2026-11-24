import { Extension, commands as tiptapCommands, type Extensions, type JSONContent } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TaskItemView } from './TaskItemView';
import { Gapcursor } from '@tiptap/extension-gapcursor';
import { History } from '@tiptap/extension-history';
import { CodeBlock } from './CodeBlock';
import { ListMerge } from './ListMerge';
import { dropUnknownContent } from '../utils/drop-unknown-content';
import { ImageBlock } from './ImageBlock';
import { LinkClickHandler } from './LinkClickHandler';
import { BoundedTable } from './BoundedTable';
import { Callout } from './Callout';
import { TocBlock } from './TocBlock';
import { getSchemaExtensions } from './schema-extensions';
import type { CoreExtensionOptions } from './get-extensions';

const InkioUi = Extension.create<Pick<CoreExtensionOptions, 'locale' | 'messages' | 'icons' | 'placeholder'>>({
  name: 'inkioUi',

  addOptions() {
    return { locale: undefined, messages: undefined, icons: undefined, placeholder: undefined };
  },

  addStorage() {
    return { ...this.options };
  },

  addCommands() {
    return {
      // Tiptap's, except a node or mark this editor doesn't have costs only itself.
      setContent: (content, options) => (props) =>
        tiptapCommands.setContent(dropUnknownContent(content as JSONContent, props.editor.schema), options)(props),
    };
  },
});

// Escape still leaves a focused viewer; only the editor adds the writing keys.
export const TabNavigation = Extension.create({
  name: 'tabIndent',
  priority: 50,
  addKeyboardShortcuts() {
    return { Escape: ({ editor }) => editor.commands.blur() };
  },
});

/** The two live surfaces share the schema, node views and document guards.
 * Only the editable preset supplies typing and drag plugins. */
export function getInteractiveExtensions(options: CoreExtensionOptions, editing?: {
  beforeMarks: Extensions;
  listKeymap: Extensions[number];
  clearMarksOnEnter?: Extensions[number];
  beforeDetails?: Extensions[number];
  detailsShortcut: Extensions[number];
}) {
  const { placeholder, locale, messages, icons, link, linkClickHandler } = options;
  // History and list normalization also apply to programmatic updates from a viewer's instance.
  const afterCode: Extensions = [];
  if (options.history !== false) afterCode.push(History);
  if (editing?.clearMarksOnEnter) afterCode.push(editing.clearMarksOnEnter);
  if (options.bulletList !== false || options.orderedList !== false || options.taskList !== false) {
    afterCode.push(ListMerge);
  }
  const extensions = getSchemaExtensions(options, {
    ...editing,
    beforeMarks: [...(editing?.beforeMarks ?? [Gapcursor]), InkioUi.configure({ locale, messages, icons, placeholder })],
    taskItem: (item) => item.extend({
      addOptions() {
        return {
          ...this.parent?.(),
          checkIcon: options.taskCheckIcon,
        };
      },
      addNodeView() {
        return ReactNodeViewRenderer(TaskItemView);
      },
    }),
    codeBlock: CodeBlock,
    afterCode,
    imageBlock: ImageBlock,
    afterImage: link !== false && linkClickHandler !== false
      ? LinkClickHandler.configure(linkClickHandler ?? {})
      : undefined,
    callout: Callout,
    table: BoundedTable,
    tocBlock: TocBlock,
  });
  if (!editing && options.tabBehavior !== 'default') extensions.push(TabNavigation);
  return extensions;
}
