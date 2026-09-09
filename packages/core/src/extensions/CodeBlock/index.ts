import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { createLowlight } from 'lowlight';
import { CodeBlockView } from './CodeBlockView';
import { applyHljsTheme, isDarkTheme, removeHljsTheme } from './hljs-theme';
import { ensureHljsLanguages } from './hljs-lazy';

// Grammars load on demand via `ensureHljsLanguages` (see `./hljs-lazy`):
// the 37 highlight.js languages used to ship inside this chunk through
// `lowlight/common`. Until a grammar arrives, blocks render through
// Tiptap's auto-detect fallback, exactly like unknown languages always did.
const lowlight = createLowlight();

export const CodeBlock = CodeBlockLowlight.extend({
  addStorage() {
    return { hljsObserver: null as MutationObserver | null };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },

  onCreate() {
    ensureHljsLanguages(lowlight, this.editor);

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

  onUpdate() {
    ensureHljsLanguages(lowlight, this.editor);
  },

  onDestroy() {
    this.storage.hljsObserver?.disconnect();
    removeHljsTheme();
  },
}).configure({
  lowlight,
});
