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
      maxLevel: { default: 3, rendered: false },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toc"]' }];
  },

  renderHTML() {
    return ['div', { 'data-type': 'toc' }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TocBlockView);
  },
});
