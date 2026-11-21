import type { InkioJSONContent } from '@inkio/core';
import { useMemo } from 'react';

const MAX_PREVIEW_LENGTH = 20_000;

export default function PlaygroundJson({ content }: { content: InkioJSONContent | null }) {
  const json = useMemo(() => (content ? JSON.stringify(content, null, 2) : ''), [content]);
  const truncated = json.length > MAX_PREVIEW_LENGTH;

  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inkio-document.json';
    document.body.append(link);
    link.click();
    link.remove();
    // Let browsers start reading the download before releasing its URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  return (
    <section className="playground-section">
      <h2 className="playground-section-label">JSON Output</h2>
      {content ? (
        <pre className="playground-json" tabIndex={0} aria-label="JSON preview">
          {truncated ? `${json.slice(0, MAX_PREVIEW_LENGTH)}\n…` : json}
        </pre>
      ) : (
        <p className="playground-note" role="status">Loading JSON…</p>
      )}
      {truncated && (
        <div className="playground-json-actions">
          <p className="playground-note">This preview is truncated.</p>
          <button type="button" className="playground-mode-btn" onClick={download}>Download full JSON</button>
        </div>
      )}
    </section>
  );
}
