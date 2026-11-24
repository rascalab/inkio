import { Node, mergeAttributes } from '@tiptap/core';

const SAFE_CSS_COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([0-9,.\s%]+\)|hsla?\([0-9,.\s%deg]+\)|[a-zA-Z]{1,20})$/;
// Bare-word branch above would also accept `expression`/`javascript`/etc.
// Those keywords alone in a custom property are inert, but reject them anyway
// to keep stored attrs free of exfiltration-looking payloads.
const UNSAFE_COLOR_KEYWORDS = new Set([
  'expression',
  'javascript',
  'url',
  'import',
  'behavior',
  'binding',
  'cookie',
  'document',
  'eval',
  'window',
]);
function isSafeColor(value: string): boolean {
  const trimmed = value.trim();
  if (!SAFE_CSS_COLOR.test(trimmed)) return false;
  if (/^[a-zA-Z]{1,20}$/.test(trimmed) && UNSAFE_COLOR_KEYWORDS.has(trimmed.toLowerCase())) {
    return false;
  }
  return true;
}

/**
 * Boundary normalization for callout colors: preset names pass through,
 * safe custom values pass through, everything else drops to null so raw
 * attrs never carry a payload for alternate renderers/exporters that read
 * them directly (renderHTML sanitizes, but it is not the only consumer).
 */
export function normalizeCalloutColor(color: unknown): string | null {
  if (typeof color !== 'string') return null;
  return isSafeColor(color) ? color : null;
}

/**
 * Icon values render verbatim into data attributes: cap length and strip
 * controls so a programmatic caller cannot persist arbitrary-length labels.
 */
export function normalizeCalloutIcon(icon: unknown): string | null {
  if (typeof icon !== 'string') return null;
  const trimmed = icon.trim();
  // Icons are short names or glyphs (the toolbar caps input at 2 chars;
  // the longest in-repo fixture is 'lightbulb' at 9). Anything longer or
  // carrying control characters is not an icon.
  if (!trimmed || Array.from(trimmed).length > 32 || /[\0\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function sanitizeCalloutAttrs<T extends { color?: unknown; icon?: unknown }>(attributes: T | undefined): T | undefined {
  if (!attributes) return attributes;
  const next = { ...attributes };
  if (next.color !== undefined) {
    (next as Record<string, unknown>).color = normalizeCalloutColor(next.color);
  }
  if (next.icon !== undefined) {
    (next as Record<string, unknown>).icon = normalizeCalloutIcon(next.icon);
  }
  return next;
}

export const CALLOUT_COLOR_PRESETS: Record<string, string> = {
  blue: 'var(--inkio-callout-blue)',
  yellow: 'var(--inkio-callout-yellow)',
  red: 'var(--inkio-callout-red)',
  green: 'var(--inkio-callout-green)',
  purple: 'var(--inkio-callout-purple)',
  gray: 'var(--inkio-callout-gray)',
};

export interface CalloutOptions {
  HTMLAttributes: Record<string, any>;
}

export const CalloutSchema = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      icon: {
        default: null,
        parseHTML: (element) => normalizeCalloutIcon(element.getAttribute('data-callout-icon')),
        renderHTML: (attributes) => {
          if (!attributes.icon) return {};
          return { 'data-callout-icon': attributes.icon };
        },
      },
      color: {
        default: null,
        parseHTML: (element) => {
          // Migration: old type-based callouts
          const oldType = element.getAttribute('data-callout-type');
          if (oldType) {
            const typeToColor: Record<string, string> = {
              info: 'blue',
              warning: 'yellow',
              tip: 'green',
              danger: 'red',
              note: 'gray',
            };
            return Object.prototype.hasOwnProperty.call(typeToColor, oldType) ? typeToColor[oldType] : null;
          }
          const color = element.getAttribute('data-callout-color');
          return normalizeCalloutColor(color === 'custom' ? element.style.getPropertyValue('--inkio-callout-bg').trim() : color);
        },
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          // If it's a preset name, use the CSS variable via data attribute
          if (Object.prototype.hasOwnProperty.call(CALLOUT_COLOR_PRESETS, attributes.color)) {
            return { 'data-callout-color': attributes.color };
          }
          // Custom color: use inline style (sanitized)
          if (!isSafeColor(attributes.color)) {
            return { 'data-callout-color': 'custom' };
          }
          return {
            'data-callout-color': 'custom',
            style: `--inkio-callout-bg: ${attributes.color}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div.inkio-callout' },
      { tag: 'div[data-callout-color]' },
      { tag: 'div[data-callout-icon]' },
      { tag: 'div[data-callout-type]' }, // legacy migration
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        { class: 'inkio-callout' },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ];
  },
});
