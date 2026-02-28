import { useMemo, useState } from 'react';
import { Editor, getDefaultCoreExtensions } from '@inkio/editor';

const initialContent = `<h2>Hello Inkio</h2>
<p>This example starts with <code>@inkio/editor</code> only.</p>
<ul>
  <li>Use the bubble and floating menus</li>
  <li>Write headings, lists, tasks, code blocks, and links</li>
  <li>Read the JSON output while you edit</li>
</ul>`;

export default function App() {
  const [json, setJson] = useState<unknown>(null);

  const extensions = useMemo(
    () => getDefaultCoreExtensions({ placeholder: 'Write something...' }),
    [],
  );

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Example</p>
        <h1>Basic React + Inkio Core</h1>
        <p className="hero-copy">
          Start here if you only need the editor, viewer, and default core extensions.
        </p>
      </section>

      <section className="editor-card">
        <Editor
          extensions={extensions}
          initialContent={initialContent}
          showBubbleMenu
          showFloatingMenu
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
