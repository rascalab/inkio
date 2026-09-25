export function getInitials(name: string): string {
  if (typeof name !== 'string') return '';
  // Array.from iterates code points, not UTF-16 units: w[0] and the final
  // slice would both split surrogate pairs (emoji) into lone surrogates.
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => Array.from(w)[0] ?? '')
    .join('')
    .toUpperCase();
  return Array.from(initials).slice(0, 2).join('');
}
