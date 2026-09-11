import BaseCodeBlock from '@tiptap/extension-code-block';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { createLowlight } from 'lowlight';
import { CodeBlockView } from './CodeBlockView';
import { applyHljsTheme, isDarkTheme, removeHljsTheme } from './hljs-theme';
import { ensureHljsLanguages, releaseEditor } from './hljs-lazy';
import { InkioLowlightPlugin } from './lowlight-plugin';

// Grammars load on demand via `ensureHljsLanguages` (see `./hljs-lazy`):
// the 37 highlight.js languages used to ship inside this chunk through
// `lowlight/common`. Until a grammar arrives, blocks render through
// Tiptap's auto-detect fallback, exactly like unknown languages always did.
const lowlight = createLowlight();

export const CodeBlock = BaseCodeBlock.extend({
  addStorage() {
    return { hljsObserver: null as MutationObserver | null };
  },

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

    const dom = this.editor.view.dom;
    applyHljsTheme(isDarkTheme(dom));

    const observer = new MutationObserver(() => {
      applyHljsTheme(isDarkTheme(dom));
    });

    // Watch class attributes for dark mode changes: `.inkio` itself (the
    // `theme` prop) and <html> (e.g. next-themes ancestor `.dark`, which
    // isDarkTheme also honors).
    const inkio = dom.closest('.inkio');
    if (inkio) {
      observer.observe(inkio, { attributes: true, attributeFilter: ['class'] });
    }
    if (document.documentElement) {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    this.storage.hljsObserver = observer;
  },

  onUpdate() {
    ensureHljsLanguages(lowlight, this.editor);
  },

  onDestroy() {
    this.storage.hljsObserver?.disconnect();
    releaseEditor(this.editor);
    removeHljsTheme();
  },
});
