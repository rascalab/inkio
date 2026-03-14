import { useMemo, useState } from 'react';
import { Editor, getDefaultExtensions } from '@inkio/simple';

const initialContent = `<h2>Hello Inkio</h2>
<p>This example starts with <code>@inkio/simple</code>.</p>
<ul>
  <li>Use the persistent toolbar for common document formatting</li>
  <li>Write headings, lists, tasks, code blocks, links, and tables</li>
  <li>Read the JSON output while you edit</li>
</ul>`;

export default function App() {
  const [json, setJson] = useState<unknown>(null);

  const extensions = useMemo(
    () => getDefaultExtensions({ placeholder: 'Write something...' }),
    [],
  );

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Example</p>
        <h1>Basic React + Inkio Simple</h1>
        <p className="hero-copy">
          Start here if you want a classic WYSIWYG editor without notion-like UI.
        </p>
      </section>

      <section className="editor-card">
        <Editor
          extensions={extensions}
          initialContent={initialContent}
          onUpdate={(next: unknown) => setJson(next)}
        />
      </section>

      <section className="json-card">
        <div className="section-title">JSON Output</div>
        <pre>{JSON.stringify(json, null, 2)}</pre>
      </section>
    </main>
  );
}
