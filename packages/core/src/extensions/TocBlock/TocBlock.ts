import { ReactNodeViewRenderer } from '@tiptap/react';
import { TocBlockView } from './TocBlockView';
import { TocBlockSchema } from './toc-block-schema';

export const TocBlock = TocBlockSchema.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TocBlockView);
  },
});
