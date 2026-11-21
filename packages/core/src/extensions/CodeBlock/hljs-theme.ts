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
