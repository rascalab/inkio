const MAX_STATIC_CHARS = 2_000_000;
const MAX_STATIC_ITEMS = 100_000;
export const MAX_STATIC_DEPTH = 64;
export const MAX_STATIC_ELEMENTS = 32_000;
export const MAX_STATIC_HEADINGS = 512;
export const MAX_STATIC_TABLE_SLOTS = 131_072;

export class StaticContentLimitError extends RangeError {
  constructor() {
    super('[inkio] Static content exceeds the document rendering limit.');
  }
}

export function assertStaticHtmlLength(html: string): void {
  if (html.length > MAX_STATIC_CHARS) throw new StaticContentLimitError();
}

/** Bound the JSON tree before schema decoding, heading extraction, or HTML generation. */
export function assertStaticJsonBudget(content: unknown): void {
  let items = MAX_STATIC_ITEMS;
  let chars = MAX_STATIC_CHARS;
  let headings = MAX_STATIC_HEADINGS;

  function visit(value: unknown, depth: number): void {
    if (--items < 0 || depth > MAX_STATIC_DEPTH) throw new StaticContentLimitError();
    if (typeof value === 'string') {
      chars -= value.length;
    } else if (Array.isArray(value)) {
      if (value.length > items) throw new StaticContentLimitError();
      for (const item of value) visit(item, depth + 1);
    } else if (value && typeof value === 'object') {
      const object = value as Record<string, unknown>;
      if (object.type === 'heading' && --headings < 0) throw new StaticContentLimitError();
      for (const key in object) {
        if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
        chars -= key.length;
        if (chars < 0) throw new StaticContentLimitError();
        visit(object[key], depth + 1);
      }
    }
    if (chars < 0) throw new StaticContentLimitError();
  }

  visit(content, 0);
}

/** Strip complete tag-shaped sequences without rescanning unterminated suffixes. */
export function stripHtmlMarkup(value: string): string {
  let tagEnd: number | undefined;
  let commentEnd: number | undefined;
  let start = 0;
  let parts: string[] | undefined;

  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) !== 60) continue; // '<'
    const offset = value.charCodeAt(i + 1) === 47 ? 2 : 1; // optional '/'
    const first = value.charCodeAt(i + offset);
    if (first !== 33 && !(first >= 65 && first <= 90) && !(first >= 97 && first <= 122)) continue;

    let end: number | undefined;
    if (value.startsWith('<!--', i)) {
      if (commentEnd === undefined || (commentEnd !== -1 && commentEnd < i)) {
        commentEnd = value.indexOf('-->', i + 4);
      }
      if (commentEnd !== -1) end = commentEnd + 2;
    }
    if (end === undefined) {
      if (tagEnd === undefined || (tagEnd !== -1 && tagEnd < i)) {
        tagEnd = value.indexOf('>', i + 1);
      }
      end = tagEnd;
    }
    if (end === -1) continue;

    (parts ??= []).push(value.slice(start, i), ' ');
    start = end + 1;
    i = end;
  }

  if (!parts) return value;
  parts.push(value.slice(start));
  return parts.join('');
}
