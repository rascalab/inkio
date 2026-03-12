import { mergeAttributes, nodeInputRule, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { EquationBlockView, EquationInlineView } from './EquationView';

export interface EquationOptions {
  HTMLAttributes: Record<string, any>;
}

const getLatex = (value: unknown) => String(value || '').trim();

const blockInputRegex = /^\$\$([^$\n]+)\$\$$/;
const inlineInputRegex = /(?:^|\s)\$([^\s$](?:[^$\n]*[^\s$])?)\$(?:\s|$)/;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    equation: {
      setEquation: (attributes: { latex: string }) => ReturnType;
      setInlineEquation: (attributes: { latex: string }) => ReturnType;
    };
  }
}

export const EquationBlock = Node.create<EquationOptions>({
  name: 'equationBlock',

  group: 'block',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-latex') || '',
        renderHTML: (attributes) => ({
          'data-latex': attributes.latex,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-equation-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ 'data-equation-block': '' }, this.options.HTMLAttributes, HTMLAttributes),
      `$$${String(HTMLAttributes['data-latex'] || '')}$$`,
    ];
  },

  addCommands() {
    return {
      setEquation:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              latex: getLatex(attributes.latex),
            },
          });
        },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: blockInputRegex,
        type: this.type,
        getAttributes: (match) => ({
          latex: getLatex(match[1]),
        }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EquationBlockView);
  },
});

export const EquationInline = Node.create<EquationOptions>({
  name: 'equationInline',

  group: 'inline',

  inline: true,

  atom: true,

  selectable: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-latex') || '',
        renderHTML: (attributes) => ({
          'data-latex': attributes.latex,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-equation-inline]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ 'data-equation-inline': '' }, this.options.HTMLAttributes, HTMLAttributes),
      `$${String(HTMLAttributes['data-latex'] || '')}$`,
    ];
  },

  addCommands() {
    return {
      setInlineEquation:
        (attributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              latex: getLatex(attributes.latex),
            },
          });
        },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: inlineInputRegex,
        type: this.type,
        getAttributes: (match) => ({
          latex: getLatex(match[1]),
        }),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EquationInlineView);
  },
});
