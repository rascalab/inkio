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
  if (next === currentTheme) return;
  currentTheme = next;
  getStyleEl().textContent = dark ? githubDark : githubLight;
}

export function isDarkTheme(editorDom: Element): boolean {
  const inkio = editorDom.closest('.inkio');
  return inkio?.classList.contains('dark') ?? false;
}

export function removeHljsTheme() {
  document.getElementById(STYLE_ID)?.remove();
  currentTheme = null;
}
