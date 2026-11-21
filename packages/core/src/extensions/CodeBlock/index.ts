import BaseCodeBlock from '@tiptap/extension-code-block';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { createLowlight } from 'lowlight';
import { CodeBlockView } from './CodeBlockView';
import { ensureHljsLanguages, releaseEditor, repaintLoadedGrammars } from './hljs-lazy';
import { InkioLowlightPlugin } from './lowlight-plugin';

// Grammars load on demand via `ensureHljsLanguages` (see `./hljs-lazy`):
// the 37 highlight.js languages used to ship inside this chunk through
// `lowlight/common`. Until a grammar arrives, blocks render through
// Tiptap's auto-detect fallback, exactly like unknown languages always did.
const lowlight = createLowlight();

export const CodeBlock = BaseCodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      InkioLowlightPlugin({
        name: this.name,
        lowlight,
        defaultLanguage: this.options.defaultLanguage,
      }),
    ];
  },

  onCreate() {
    ensureHljsLanguages(lowlight, this.editor);
    repaintLoadedGrammars(this.editor);
  },

  onUpdate({ transaction, appendedTransactions }) {
    // Passing the update's transactions lets the scan inspect only the
    // changed ranges instead of walking the whole doc on every keystroke.
    ensureHljsLanguages(lowlight, this.editor, [transaction, ...(appendedTransactions ?? [])]);
  },

  onDestroy() {
    releaseEditor(this.editor);
  },
});
