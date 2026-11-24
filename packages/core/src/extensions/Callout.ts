import { wrappingInputRule } from '@tiptap/core';
import { createCalloutToolbarPlugin } from './callout-toolbar-plugin';
import { CalloutSchema, normalizeCalloutColor, normalizeCalloutIcon, sanitizeCalloutAttrs } from './callout-schema';

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

export const Callout = CalloutSchema.extend({
  addCommands() {
    return {
      setCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, sanitizeCalloutAttrs(attributes));
        },
      toggleCallout:
        (attributes) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, sanitizeCalloutAttrs(attributes));
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
      updateCalloutIcon:
        (icon) =>
        ({ commands }) => {
          const safeIcon = normalizeCalloutIcon(icon);
          if (safeIcon === null) return false;
          return commands.updateAttributes(this.name, { icon: safeIcon });
        },
      updateCalloutColor:
        (color) =>
        ({ commands }) => {
          const safeColor = normalizeCalloutColor(color);
          if (safeColor === null) return false;
          return commands.updateAttributes(this.name, { color: safeColor });
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
