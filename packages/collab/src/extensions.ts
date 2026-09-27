import type { Extensions } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import type * as Y from 'yjs';
import type { CollabProvider, CollabUser } from './provider';

export const COLLAB_CONFLICTING_EXTENSIONS = ['history', 'undoRedo'] as const;

export function removeConflictingExtensions(extensions: Extensions): Extensions {
  return extensions.filter((extension) => {
    const name = (extension as { name?: unknown }).name;
    return (
      typeof name !== 'string' ||
      !(COLLAB_CONFLICTING_EXTENSIONS as readonly string[]).includes(name)
    );
  });
}

const FALLBACK_USER: CollabUser = { name: 'Anonymous', color: '#888888' };

/** Remote peer input must never reach CSS raw: `;` or braces break out of
 * the declaration they are interpolated into. Everything else (including
 * exotic-but-valid colors) passes through untouched. */
function isSafeCssColor(value: string): boolean {
  return !/[;{}]/.test(value);
}

/** Self-styled caret so consumers need no extra stylesheet. */
function renderCaret(user: Record<string, unknown>): HTMLElement {
  // Remote peer input must never reach CSS raw: a crafted color string
  // breaks out of the declaration (e.g. `red;background:url(...)`).
  const rawColor = typeof user.color === 'string' ? user.color : FALLBACK_USER.color;
  const color = isSafeCssColor(rawColor) ? rawColor : FALLBACK_USER.color;
  const caret = document.createElement('span');
  caret.className = 'collaboration-carets__caret';
  caret.style.cssText = `position:relative;margin:0 -1px;border-left:1px solid ${color};border-right:1px solid ${color};word-break:normal;pointer-events:none;`;
  const label = document.createElement('div');
  label.className = 'collaboration-carets__label';
  label.style.cssText = `position:absolute;top:-1.4em;left:-1px;padding:0.1rem 0.3rem;border-radius:3px 3px 3px 0;font-size:12px;font-style:normal;font-weight:600;line-height:normal;white-space:nowrap;user-select:none;color:#fff;background-color:${color};`;
  label.textContent = typeof user.name === 'string' ? user.name : FALLBACK_USER.name;
  caret.append(label);
  return caret;
}

export interface CollabExtensionsOptions {
  document: Y.Doc;
  /** Adds remote carets and selections when given. */
  provider?: CollabProvider | null;
  user?: CollabUser;
}

export function createCollabExtensions({
  document,
  provider,
  user,
}: CollabExtensionsOptions): Extensions {
  const extensions: Extensions = [Collaboration.configure({ document })];
  if (provider) {
    extensions.push(
      CollaborationCaret.configure({
        provider,
        // The caret plugin overwrites the awareness `user` field with this
        // option on mount, so fall back to whatever the provider already set.
        user: user ?? provider.awareness?.getLocalState()?.user ?? FALLBACK_USER,
        render: renderCaret,
      }),
    );
  }
  return extensions;
}
