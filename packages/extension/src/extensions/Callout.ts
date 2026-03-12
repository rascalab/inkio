import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';
import { createCalloutToolbarPlugin } from './CalloutToolbarPlugin';

const SAFE_CSS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([0-9,.\s%]+\)|hsla?\([0-9,.\s%deg]+\)|[a-zA-Z]{1,20})$/;
function isSafeColor(value: string): boolean {
  return SAFE_CSS_COLOR.test(value.trim());
}

export const CALLOUT_COLOR_PRESETS: Record<string, string> = {
  blue: 'var(--inkio-callout-blue)',
  yellow: 'var(--inkio-callout-yellow)',
  red: 'var(--inkio-callout-red)',
  green: 'var(--inkio-callout-green)',
  purple: 'var(--inkio-callout-purple)',
  gray: 'var(--inkio-callout-gray)',
};

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Set a callout block */
      setCallout: (attributes?: { icon?: string; color?: string }) => ReturnType;
      /** Toggle a callout block */
      toggleCallout: (attributes?: { icon?: string; color?: string }) => ReturnType;
      /** Unset a callout block */
      unsetCallout: () => ReturnType;
      /** Update callout icon */
      updateCalloutIcon: (icon: string) => ReturnType;
      /** Update callout color */
      updateCalloutColor: (color: string) => ReturnType;
    };
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      icon: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-callout-icon') || null,
        renderHTML: (attributes) => {
          if (!attributes.icon) return {};
          return { 'data-callout-icon': attributes.icon };
        },
      },
      color: {
        default: null,
        parseHTML: (element) => {
          // Migration: old type-based callouts
          const oldType = element.getAttribute('data-callout-type');
          if (oldType) {
            const typeToColor: Record<string, string> = {
              info: 'blue',
              warning: 'yellow',
              tip: 'green',
              danger: 'red',
              note: 'gray',
            };
            return typeToColor[oldType] || null;
          }
          return element.getAttribute('data-callout-color') || null;
        },
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          // If it's a preset name, use the CSS variable via data attribute
          if (attributes.color in CALLOUT_COLOR_PRESETS) {
            return { 'data-callout-color': attributes.color };
          }
          // Custom color: use inline style (sanitized)
          if (!isSafeColor(attributes.color)) {
            return { 'data-callout-color': 'custom' };
          }
          return {
            'data-callout-color': 'custom',
            style: `--inkio-callout-bg: ${attributes.color}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-callout-color]' },
      { tag: 'div[data-callout-icon]' },
      { tag: 'div[data-callout-type]' }, // legacy migration
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        { class: 'inkio-callout' },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes);
        },
      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attributes);
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
      updateCalloutIcon:
        (icon) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { icon });
        },
      updateCalloutColor:
        (color) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, { color });
        },
    };
  },

  addProseMirrorPlugins() {
    return [createCalloutToolbarPlugin(this.editor)];
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^\| $/,
        type: this.type,
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      // Exit callout with double Enter
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from, empty } = selection;

        if (!empty) {
          return false;
        }

        // Check if we're in a callout
        const calloutDepth = $from.depth;
        let isInCallout = false;
        for (let d = calloutDepth; d > 0; d--) {
          if ($from.node(d).type.name === this.name) {
            isInCallout = true;
            break;
          }
        }

        if (!isInCallout) {
          return false;
        }

        // Check if current paragraph is empty
        const isEmptyParagraph =
          $from.parent.type.name === 'paragraph' && $from.parent.textContent === '';

        if (isEmptyParagraph) {
          // Check if there's a previous empty paragraph (double enter)
          const pos = $from.before($from.depth);
          if (pos > 0) {
            const nodeBefore = state.doc.resolve(pos).nodeBefore;
            if (
              nodeBefore &&
              nodeBefore.type.name === 'paragraph' &&
              nodeBefore.textContent === ''
            ) {
              // Exit the callout
              return editor.chain().lift(this.name).run();
            }
          }
        }

        return false;
      },
    };
  },
});
