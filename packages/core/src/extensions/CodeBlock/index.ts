import { CodeBlock as BaseCodeBlock } from '@tiptap/extension-code-block';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CodeBlockView } from './CodeBlockView';
import { ensureHljsLanguages, loadedLowlight, releaseEditor, repaintLoadedGrammars } from './hljs-lazy';
import { InkioLowlightPlugin } from './lowlight-plugin';

export const CodeBlock = BaseCodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      InkioLowlightPlugin({
        name: this.name,
        getLowlight: () => loadedLowlight,
        defaultLanguage: this.options.defaultLanguage,
      }),
    ];
  },

  onCreate() {
    ensureHljsLanguages(this.editor);
    repaintLoadedGrammars(this.editor);
  },

  onTransaction({ transaction, appendedTransactions }) {
    // Silent content replacements (emitUpdate: false) can introduce code too.
    if (!transaction.docChanged && !appendedTransactions.some((tr) => tr.docChanged)) return;
    ensureHljsLanguages(this.editor, [transaction, ...appendedTransactions]);
  },

  onDestroy() {
    releaseEditor(this.editor);
  },
});
