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

/**
 * Bumped on every mutation of the grammar bookkeeping above so the
 * per-editor scan cache below can tell "same doc, new grammar state" apart
 * from a genuinely redundant scan. In particular a failed load must still be
 * retried by `scheduleRetry` even when the doc did not change.
 */
let grammarStateVersion = 0;
function touchGrammarState(): void {
  grammarStateVersion += 1;
}

/**
 * Live editor instances. A batch started by an editor that unmounts before
 * completion (React StrictMode double-mount, HMR) must still repaint the
 * replacement instance — so completions repaint every live editor, not just
 * the one that triggered the load. Entries are removed in `releaseEditor`.
 */
const liveEditors = new Set<Editor>();

export function retainEditor(editor: Editor): void {
  liveEditors.add(editor);
}

export function releaseEditor(editor: Editor): void {
  liveEditors.delete(editor);
}

function repaintLiveEditors(loaded: Set<string>): void {
  for (const editor of liveEditors) {
    if (editor.isDestroyed) {
      liveEditors.delete(editor);
      continue;
    }
    refreshCodeBlockDecorations(editor, loaded);
  }
}

async function loadGrammar(lowlight: InkioLowlight, name: string): Promise<string | null> {
  try {
    const grammarModule = await LANGUAGE_LOADERS[name]();
    lowlight.register(name, grammarModule.default);
    if (name === 'typescript') {
      lowlight.registerAlias({ typescript: ['tsx', 'jsx'] });
    }
    loadedGrammars.add(name);
    touchGrammarState();
    loadAttempts.delete(name);
    return name;
  } catch (error) {
    // Visible because a missing chunk (stale deploy, transient network,
    // dev-compile race) would otherwise leave code blocks permanently
    // unhighlighted with no trace. Retried by the caller with backoff.
    console.warn(`[inkio] code highlight grammar failed to load: ${name}`, error);
    // A missing grammar must never break the editor — the block keeps the
    // unhighlighted (auto-detect) rendering.
    return null;
  }
}

/**
 * Per-editor result of the last `ensureHljsLanguages` scan. `onUpdate` fires
 * only on change so `doc` identity is fresh per keystroke, but duplicate
 * calls with the same doc (StrictMode remount, retry fan-out over live
 * editors, onCreate + onUpdate for one state) can skip the walk entirely.
 */
const lastScanByEditor = new WeakMap<
  Editor,
  { doc: unknown; nodeSize: number; childCount: number; grammarVersion: number }
>();

function shouldSkipScan(editor: Editor): boolean {
  const cached = lastScanByEditor.get(editor);
  if (!cached) return false;
  if (cached.doc !== editor.state.doc) return false;
  if (cached.grammarVersion !== grammarStateVersion) return false;
  const doc = editor.state.doc;
  return cached.nodeSize === doc.nodeSize && cached.childCount === doc.childCount;
}

function recordScan(editor: Editor): void {
  const doc = editor.state.doc;
  lastScanByEditor.set(editor, {
    doc,
    nodeSize: doc.nodeSize,
    childCount: doc.childCount,
    grammarVersion: grammarStateVersion,
  });
}

/**
 * Collect code block languages needing a grammar load. Code blocks can never
 * nest inside another textblock, so textblock subtrees (paragraphs, headings,
 * non-code text) are pruned instead of visiting every inline text node.
 */
function collectMissingGrammars(editor: Editor): string[] {
  const needed: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'codeBlock') {
      const resolved = resolveHljsLanguageName(node.attrs.language as string | null | undefined);
      if (resolved && !loadedGrammars.has(resolved) && !pendingGrammars.has(resolved)) {
        needed.push(resolved);
      }
      // A code block's children are plain text — never nested code blocks.
      return false;
    }
    if (node.isTextblock) return false;
    return true;
  });
  return needed;
}

/**
 * Scan the document for code blocks and load any missing grammars, then
 * refresh the view so fresh highlighting paints. Safe to call on every
 * update: already-loaded grammars are skipped and concurrent loads are
 * deduplicated. Collection and bookkeeping run synchronously, so two
 * overlapping calls can never load the same grammar twice. Repeat calls with
 * an unchanged doc + unchanged grammar state skip the walk via the scan
 * cache above.
 */
export function ensureHljsLanguages(lowlight: InkioLowlight, editor: Editor): void {
  retainEditor(editor);
  if (shouldSkipScan(editor)) return;
  const needed = collectMissingGrammars(editor);
  recordScan(editor);
  if (needed.length === 0) return;

  let batch!: Promise<unknown>;
  batch = Promise.all(needed.map((name) => loadGrammar(lowlight, name))).then((names) => {
    for (const name of needed) {
      if (pendingGrammars.get(name) === batch) {
        pendingGrammars.delete(name);
        touchGrammarState();
      }
    }
    const loaded = new Set(names.filter((name): name is string => name !== null));
    if (loaded.size > 0) {
      repaintLiveEditors(loaded);
    }
    const failed = needed.filter((name) => !loadedGrammars.has(name));
    if (failed.length > 0) {
      scheduleRetry(lowlight, failed);
    }
  });
  for (const name of needed) pendingGrammars.set(name, batch);
  touchGrammarState();
}

/**
 * A transient load failure (slow network, stale chunk after deploy,
 * dev-compile race) must not leave code blocks permanently plain waiting
 * for the next keystroke. Retry with backoff, capped per grammar.
 */
const RETRY_DELAYS_MS = [1500, 4000];
const loadAttempts = new Map<string, number>();

function scheduleRetry(lowlight: InkioLowlight, failed: string[]): void {
  const retryable = failed.filter(
    (name) => (loadAttempts.get(name) ?? 0) < RETRY_DELAYS_MS.length,
  );
  if (retryable.length === 0) return;
  const delay = Math.max(...retryable.map((name) => RETRY_DELAYS_MS[loadAttempts.get(name) ?? 0]!));
  for (const name of retryable) {
    loadAttempts.set(name, (loadAttempts.get(name) ?? 0) + 1);
  }
  touchGrammarState();
  setTimeout(() => {
    for (const editor of liveEditors) {
      if (editor.isDestroyed) {
        liveEditors.delete(editor);
        continue;
      }
      ensureHljsLanguages(lowlight, editor);
    }
  }, delay);
}

/**
 * Tiptap's lowlight plugin only recomputes a block when a transaction step
 * with `from`/`to` spans it — an attribute-only step (`AttrStep` has only
 * `pos`) is silently ignored, so `setNodeAttribute` can never repaint.
 * Replacing each newly-loaded block with an identical copy satisfies the
 * span check with zero visible change (same content/attrs, excluded from
 * undo history). Blocks using other grammars are left untouched so
 * unrelated node views never re-render.
 */
function refreshCodeBlockDecorations(editor: Editor, loaded: Set<string>): void {
  const { tr } = editor.state;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock') {
      if (loaded.has(resolveHljsLanguageName(node.attrs.language as string | null | undefined) ?? '')) {
        tr.replaceWith(pos, pos + node.nodeSize, node);
      }
      // Code block children are plain text — never nested code blocks.
      return false;
    }
    if (node.isTextblock) return false;
    return true;
  });
  if (tr.docChanged) {
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  }
}
