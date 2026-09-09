import type { Editor } from '@tiptap/core';

export type InkioLowlight = ReturnType<typeof import('lowlight').createLowlight>;

interface HljsLanguageModule {
  default: Parameters<InkioLowlight['register']>[1];
}

/**
 * On-demand loaders for the 37 highlight.js grammars that used to ship
 * inside the main bundle via `lowlight/common`. Each entry compiles to its
 * own async chunk, so documents without code blocks pay nothing and
 * documents with code blocks only load the grammars they actually use.
 */
const LANGUAGE_LOADERS: Record<string, () => Promise<HljsLanguageModule>> = {
  arduino: () => import('highlight.js/lib/languages/arduino'),
  bash: () => import('highlight.js/lib/languages/bash'),
  c: () => import('highlight.js/lib/languages/c'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  css: () => import('highlight.js/lib/languages/css'),
  diff: () => import('highlight.js/lib/languages/diff'),
  go: () => import('highlight.js/lib/languages/go'),
  graphql: () => import('highlight.js/lib/languages/graphql'),
  ini: () => import('highlight.js/lib/languages/ini'),
  java: () => import('highlight.js/lib/languages/java'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  json: () => import('highlight.js/lib/languages/json'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  less: () => import('highlight.js/lib/languages/less'),
  lua: () => import('highlight.js/lib/languages/lua'),
  makefile: () => import('highlight.js/lib/languages/makefile'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  objectivec: () => import('highlight.js/lib/languages/objectivec'),
  perl: () => import('highlight.js/lib/languages/perl'),
  php: () => import('highlight.js/lib/languages/php'),
  'php-template': () => import('highlight.js/lib/languages/php-template'),
  plaintext: () => import('highlight.js/lib/languages/plaintext'),
  python: () => import('highlight.js/lib/languages/python'),
  'python-repl': () => import('highlight.js/lib/languages/python-repl'),
  r: () => import('highlight.js/lib/languages/r'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rust: () => import('highlight.js/lib/languages/rust'),
  scss: () => import('highlight.js/lib/languages/scss'),
  shell: () => import('highlight.js/lib/languages/shell'),
  sql: () => import('highlight.js/lib/languages/sql'),
  swift: () => import('highlight.js/lib/languages/swift'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  vbnet: () => import('highlight.js/lib/languages/vbnet'),
  wasm: () => import('highlight.js/lib/languages/wasm'),
  xml: () => import('highlight.js/lib/languages/xml'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
};

/** UI language values that resolve to a different grammar module. */
const LANGUAGE_ALIASES: Record<string, string> = {
  jsx: 'typescript',
  tsx: 'typescript',
};

/**
 * Normalize a code block `language` attribute to a loadable grammar name.
 * Returns `null` for empty/unknown values, which keeps Tiptap's
 * auto-detect fallback — the same behavior as before for languages
 * outside the bundled set.
 */
export function resolveHljsLanguageName(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const canonical = LANGUAGE_ALIASES[normalized] ?? normalized;
  return LANGUAGE_LOADERS[canonical] ? canonical : null;
}

const loadedGrammars = new Set<string>();
const pendingGrammars = new Map<string, Promise<unknown>>();

async function loadGrammar(lowlight: InkioLowlight, name: string): Promise<string | null> {
  try {
    const grammarModule = await LANGUAGE_LOADERS[name]();
    lowlight.register(name, grammarModule.default);
    if (name === 'typescript') {
      lowlight.registerAlias({ typescript: ['tsx', 'jsx'] });
    }
    loadedGrammars.add(name);
    return name;
  } catch {
    // A missing grammar must never break the editor — the block keeps the
    // unhighlighted (auto-detect) rendering.
    return null;
  }
}

/**
 * Scan the document for code blocks and load any missing grammars, then
 * refresh the view so fresh highlighting paints. Safe to call on every
 * update: already-loaded grammars are skipped and concurrent loads are
 * deduplicated. Collection and bookkeeping run synchronously, so two
 * overlapping calls can never load the same grammar twice.
 */
export function ensureHljsLanguages(lowlight: InkioLowlight, editor: Editor): void {
  const needed: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'codeBlock') {
      const resolved = resolveHljsLanguageName(node.attrs.language as string | null | undefined);
      if (resolved && !loadedGrammars.has(resolved) && !pendingGrammars.has(resolved)) {
        needed.push(resolved);
      }
    }
    return true;
  });
  if (needed.length === 0) return;

  let batch!: Promise<unknown>;
  batch = Promise.all(needed.map((name) => loadGrammar(lowlight, name))).then((names) => {
    for (const name of needed) {
      if (pendingGrammars.get(name) === batch) pendingGrammars.delete(name);
    }
    if (names.some((name) => name !== null) && !editor.isDestroyed) {
      refreshCodeBlockDecorations(editor);
    }
  });
  for (const name of needed) pendingGrammars.set(name, batch);
}

/**
 * Tiptap's lowlight plugin only recomputes highlighting for transactions
 * with `docChanged`, so an empty transaction is a no-op. Rewriting each
 * code block's own `language` attribute forces recomputation without
 * changing content, selection, or undo history.
 */
function refreshCodeBlockDecorations(editor: Editor): void {
  const { tr } = editor.state;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock') {
      tr.setNodeAttribute(pos, 'language', node.attrs.language ?? null);
    }
    return true;
  });
  if (tr.docChanged) {
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  }
}
