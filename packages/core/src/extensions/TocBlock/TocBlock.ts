import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TocBlockView } from './TocBlockView';

export interface TocBlockOptions {
  maxLevel: number;
}

export const TocBlock = Node.create<TocBlockOptions>({
  name: 'tocBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { maxLevel: 3 };
  },

  addAttributes() {
    return {
      // Default follows the configured option so `configure({ maxLevel })`
      // applies to inserted blocks; explicit attrs still win per node.
      maxLevel: { default: this.options.maxLevel, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toc"]' }];
  },

  renderHTML() {
    // Static HTML (Viewer/SSR) has no live headings — render a placeholder
    // instead of an empty box so the block is visible and parseable.
    return ['div', { 'data-type': 'toc', class: 'inkio-toc-placeholder' }, 'Table of contents'];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TocBlockView);
  },
});
