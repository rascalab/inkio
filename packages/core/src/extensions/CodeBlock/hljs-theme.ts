// NOTE: The hljs theme <style> tag (id="inkio-hljs-theme") is a global page-level singleton.
// All editor instances on the same page share the same highlight.js theme.
// If multiple editors need different themes, consumers must scope styles manually
// (e.g., by wrapping each editor in a shadow DOM or prefixing hljs class selectors).
import { githubLight, githubDark } from './hljs-themes';

const STYLE_ID = 'inkio-hljs-theme';
let currentTheme: 'light' | 'dark' | null = null;

function getStyleEl(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  return el;
}

export function applyHljsTheme(dark: boolean) {
  const next = dark ? 'dark' : 'light';
  const expected = dark ? githubDark : githubLight;
  const el = getStyleEl();
  // Don't trust the module-level cache alone: HMR or external DOM edits can
  // remove/replace the tag, which previously left code blocks unstyled
  // (plain white text) with no recovery path.
  if (next === currentTheme && el.textContent === expected) return;
  currentTheme = next;
  el.textContent = expected;
}

/**
 * Mirror the token dark-mode selector (tokens.css):
 * `.inkio.dark` or `.dark/.dark-theme` ancestor with `.inkio:not(.light)`.
 * Checking only `.inkio.dark` misses the common next-themes setup where
 * `.dark` lives on <html> and the theme prop hasn't caught up.
 */
export function isDarkTheme(editorDom: Element): boolean {
  const inkio = editorDom.closest('.inkio');
  if (!inkio) return false;
  if (inkio.classList.contains('dark')) return true;
  if (inkio.classList.contains('light')) return false;
  return !!inkio.parentElement?.closest('.dark, .dark-theme');
}

export function removeHljsTheme() {
  document.getElementById(STYLE_ID)?.remove();
  currentTheme = null;
}
