import { type NodeViewProps, NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { useCallback, useState } from 'react';
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

export function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const [copied, setCopied] = useState(false);
  const language = (node.attrs.language as string) || '';
  const isEditable = editor.isEditable;

  const handleCopy = useCallback(() => {
    if (copied) return;
    navigator.clipboard.writeText(node.textContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [node, copied]);

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
                className={`inkio-codeblock-copy${copied ? ' is-copied' : ''}`}
                onClick={handleCopy}
                disabled={copied}
                aria-label={copied ? 'Copied' : 'Copy code'}
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
