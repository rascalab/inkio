import { TextSelection } from '@tiptap/pm/state';
import { editorUi } from '../context/editor-ui';
import type { InkioIconComponent } from '../icons';
import type { InkioIconRegistry } from '../icons/registry';
import { ListKeymap } from '@tiptap/extension-list';
import { Dropcursor } from '@tiptap/extension-dropcursor';
import { Gapcursor } from '@tiptap/extension-gapcursor';
import { Placeholder } from '@tiptap/extension-placeholder';
import { ClearMarksOnEnter } from './ClearMarksOnEnter';
import { KeepSelectedBlock } from './KeepSelectedBlock';
import { LineBelowLastBlock } from './LineBelowLastBlock';
import type { ImageBlockOptions } from './ImageBlock';
import type { LinkClickHandlerOptions } from './LinkClickHandler';
import {
  editorMessages,
  type InkioCoreMessageOverrides,
  type InkioLocaleInput,
  type InkioMessageOverrides,
} from '../i18n/messages';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { DetailsShortcut } from './DetailsShortcut';
import { getInteractiveExtensions, TabNavigation } from './interactive-extensions';

export interface CoreExtensionOptions {
  /** Placeholder text shown when the editor is empty */
  placeholder?: string;
  /** Locale of the words node views and the default placeholder show */
  locale?: InkioLocaleInput;
  /** Message overrides for those words */
  messages?: InkioCoreMessageOverrides | InkioMessageOverrides;
  /** Icon overrides for what node views draw */
  icons?: Partial<InkioIconRegistry>;
  /** Set to `false` to disable heading, or pass `{ levels }` to customize */
  heading?: false | { levels: number[] };
  /** Set to `false` to disable bold */
  bold?: false;
  /** Set to `false` to disable italic */
  italic?: false;
  /** Set to `false` to disable underline */
  underline?: false;
  /** Set to `false` to disable strikethrough */
  strike?: false;
  /** Set to `false` to disable inline code */
  code?: false;
  /** Set to `false` to disable highlight */
  highlight?: false;
  /** Set to `false` to disable text color */
  textColor?: false;
  /** Set to `false` to disable subscript */
  subscript?: false;
  /** Set to `false` to disable superscript */
  superscript?: false;
  /** Set to `false` to disable link, or pass options to customize */
  link?: false | { openOnClick?: boolean; autolink?: boolean; defaultProtocol?: string };
  /** Set to `false` to disable text alignment, or pass node types to customize. */
  textAlign?: false | { types?: ('heading' | 'paragraph')[] };
  /** Set to `false` to disable bullet list */
  bulletList?: false;
  /** Set to `false` to disable ordered list */
  orderedList?: false;
  /** Set to `false` to disable task list */
  taskList?: false;
  /** Set to `false` to disable blockquote */
  blockquote?: false;
  /** Set to `false` to disable horizontal rule */
  horizontalRule?: false;
  /** Set to `false` to disable code block */
  codeBlock?: false;
  /** Set to `false` to disable history (undo/redo) */
  history?: false;
  /** Set to `false` to disable clear marks on enter */
  clearMarksOnEnter?: false;
  /** Set to `false` to disable image block, or pass options to customize */
  imageBlock?: false | Omit<Partial<ImageBlockOptions>, 'HTMLAttributes'>;
  /** Set to `false` to disable Cmd/Ctrl+Click link handler, or pass options to customize.
   *  Requires the `link` extension to be enabled (default). Ignored when `link` is `false`. */
  linkClickHandler?: false | LinkClickHandlerOptions;
  /**
   * Tab key behavior inside the editor.
   * - `'indent'` (default): Tab sinks list items / Shift+Tab lifts them. Prevents browser focus navigation.
   * - `'default'`: Tab follows normal browser behavior (focus next element).
   */
  tabBehavior?: 'indent' | 'default';
  /** Custom icon component for the task list checkbox (checked state). Defaults to Lucide Check. */
  taskCheckIcon?: InkioIconComponent;
  /** Set to `false` to disable the callout block extension */
  callout?: false;
  /** Set to `false` to disable the toggle list (details/summary) extension */
  toggleList?: false;
  /** Set to `false` to disable the table extension */
  table?: false;
  /** Set to `false` to disable keyboard shortcuts extension */
  keyboardShortcuts?: false;
  /**
   * Set to `false` to disable the inline table of contents block.
   * Pass `{ maxLevel }` to cap heading depth for inserted blocks.
   */
  tocBlock?: false | { maxLevel?: number };
}

export const getExtensions = (options: CoreExtensionOptions = {}) => {
  const extensions = getInteractiveExtensions(options, {
    beforeMarks: [
      Dropcursor,
      Gapcursor,
      LineBelowLastBlock,
      KeepSelectedBlock,
      Placeholder.configure({
        placeholder: ({ editor }) => editorUi(editor).placeholder || editorMessages(editor).editor.placeholder,
      }),
    ],
    listKeymap: ListKeymap,
    clearMarksOnEnter: options.clearMarksOnEnter !== false ? ClearMarksOnEnter : undefined,
    beforeDetails: options.keyboardShortcuts !== false ? KeyboardShortcuts : undefined,
    detailsShortcut: DetailsShortcut,
  });

  if (options.tabBehavior !== 'default') {
    extensions.push(
      TabNavigation.extend({
        addKeyboardShortcuts() {
          // Tab writes: it nests a list item, indents code (CodeBlock) or moves
          // between cells (Table), and anywhere else types a tab. Escape leaves
          // the editor, so keyboard and screen-reader users are not trapped.
          const listItemTypeAtSelection = (
            editor: { state: { selection: unknown } },
          ): 'listItem' | 'taskItem' | null => {
            try {
              const { state } = editor;
              const sel = state.selection as { $from?: { depth: number; node: (d: number) => { type: { name: string } } } };
              const $from = sel.$from;
              if (!$from) return null;
              for (let d = $from.depth; d >= 1; d--) {
                const name = $from.node(d).type.name;
                if (name === 'listItem' || name === 'taskItem') return name;
              }
            } catch {
              return null;
            }
            return null;
          };
          // Table and CodeBlock answer first (see `priority`); this is what is left.
          return {
            Tab: ({ editor }) => {
              const type = listItemTypeAtSelection(editor);
              if (type) {
                if (editor.can().sinkListItem(type)) return editor.commands.sinkListItem(type);
                return true;
              }
              return editor.commands.command(({ tr, dispatch }) => {
                if (!(tr.selection instanceof TextSelection)) return true;
                if (dispatch) tr.insertText('\t');
                return true;
              });
            },
            'Shift-Tab': ({ editor }) => {
              const type = listItemTypeAtSelection(editor);
              if (type) {
                if (editor.can().liftListItem(type)) return editor.commands.liftListItem(type);
                return true;
              }
              return editor.commands.command(({ tr, dispatch }) => {
                const { $from, empty } = tr.selection;
                if (empty && $from.nodeBefore?.text?.endsWith('\t') && dispatch) {
                  tr.delete($from.pos - 1, $from.pos);
                }
                return true;
              });
            },
            ...this.parent?.(),
          };
        },
      }),
    );
  }

  return extensions;
};
