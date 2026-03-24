import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { common, createLowlight } from 'lowlight';
import { CodeBlockView } from './CodeBlockView';
import { applyHljsTheme, isDarkTheme, removeHljsTheme } from './hljs-theme';

const lowlight = createLowlight(common);
lowlight.registerAlias('typescript', ['tsx', 'jsx']);

export const CodeBlock = CodeBlockLowlight.extend({
  addStorage() {
    return { hljsObserver: null as MutationObserver | null };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },

  onCreate() {
    const dom = this.editor.view.dom;
    applyHljsTheme(isDarkTheme(dom));

    const observer = new MutationObserver(() => {
      applyHljsTheme(isDarkTheme(dom));
    });

    // Watch class attribute on .inkio for dark mode changes
    const inkio = dom.closest('.inkio');
    if (inkio) {
      observer.observe(inkio, { attributes: true, attributeFilter: ['class'] });
    }

    this.storage.hljsObserver = observer;
  },

  onDestroy() {
    this.storage.hljsObserver?.disconnect();
    removeHljsTheme();
  },
}).configure({
  lowlight,
});
