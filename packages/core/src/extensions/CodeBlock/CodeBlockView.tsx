import { type NodeViewProps, NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { memo, useCallback, useState } from 'react';
import { CopyIcon, CheckIcon } from '../../icons';

const POPULAR_LANGUAGES = [
  { value: '', label: 'Plain text' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'tsx', label: 'TSX' },
  { value: 'jsx', label: 'JSX' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
];

/**
 * Best-effort legacy copy for contexts where the async Clipboard API is
 * unavailable or permission is denied (insecure context, denied permission).
 * Returns true when the copy plausibly succeeded.
 */
export function legacyCopyText(text: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    textarea.remove();
    return ok;
  } catch {
    return false;
  }
}

function CodeBlockViewInner({ node, updateAttributes, editor }: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const language = (node.attrs.language as string) || '';
  const isEditable = editor.isEditable;

  const showCopied = useCallback(() => {
    setCopied(true);
    setCopyFailed(false);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const showCopyError = useCallback(() => {
    setCopyFailed(true);
    setTimeout(() => setCopyFailed(false), 2000);
  }, []);

  const handleCopy = useCallback(() => {
    if (copied) return;
    const text = node.textContent;
    const clipboard = (navigator as Navigator & { clipboard?: Clipboard }).clipboard;
    if (clipboard?.writeText) {
      clipboard.writeText(text).then(showCopied, () => {
        // Async clipboard denied/failed — fall back before surfacing an error.
        if (legacyCopyText(text)) showCopied();
        else showCopyError();
      });
      return;
    }
    if (legacyCopyText(text)) showCopied();
    else showCopyError();
  }, [node, copied, showCopied, showCopyError]);

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateAttributes({ language: e.target.value || null });
    },
    [updateAttributes],
  );

  return (
    <NodeViewWrapper className="inkio-codeblock">
      <div className="inkio-codeblock-content">
        <div className="inkio-codeblock-overlay" contentEditable={false}>
          {isEditable ? (
            <select
              className="inkio-codeblock-lang"
              value={language}
              onChange={handleLanguageChange}
            >
              {POPULAR_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
              {language && !POPULAR_LANGUAGES.some((l) => l.value === language) && (
                <option value={language}>{language}</option>
              )}
            </select>
          ) : (
            <>
              {language && (
                <span className="inkio-codeblock-lang-badge">{language}</span>
              )}
              <button
                type="button"
                className={`inkio-codeblock-copy${copied ? ' is-copied' : ''}${copyFailed ? ' is-error' : ''}`}
                onClick={handleCopy}
                disabled={copied}
                aria-label={copied ? 'Copied' : copyFailed ? 'Copy failed — try again' : 'Copy code'}
                title={copyFailed ? 'Copy failed — browser blocked clipboard access' : undefined}
              >
                {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              </button>
            </>
          )}
        </div>
        <pre>
          <code className={language ? `language-${language}` : undefined}>
            <NodeViewContent />
          </code>
        </pre>
      </div>
    </NodeViewWrapper>
  );
}

/**
 * ProseMirror preserves node object identity for untouched subtrees, but
 * tiptap re-invokes the React tree on every transaction. Skip re-renders
 * unless our own node (identity covers attrs + text) or selection state
 * actually changed. Deliberately ignored: `decorations` (fresh array per
 * transaction), `updateAttributes`/`getPos` (tiptap rebinds them per
 * update — behaviorally identical). The code text itself is rendered by
 * ProseMirror (NodeViewContent), not React, so this is safe.
 */
function shallowEqualAttributes(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

export const CodeBlockView = memo(
  CodeBlockViewInner,
  (prev, next) =>
    prev.node === next.node &&
    prev.selected === next.selected &&
    prev.editor === next.editor &&
    prev.extension === next.extension &&
    shallowEqualAttributes(
      prev.HTMLAttributes as Record<string, unknown> | undefined,
      next.HTMLAttributes as Record<string, unknown> | undefined,
    ),
);
