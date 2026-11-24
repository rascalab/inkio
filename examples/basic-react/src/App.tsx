import { useEffect, useRef, useState } from 'react';
import { Editor, read, type InkioEditor } from '@inkio/simple';

const content = `<h2>Hello Inkio</h2>
<p>This example starts with <code>@inkio/simple</code>.</p>
<ul>
  <li>Use the persistent toolbar for common document formatting</li>
  <li>Write headings, lists, tasks, code blocks, links, and tables</li>
  <li>Read the JSON output while you edit</li>
</ul>`;

export default function App() {
  const [preview, setPreview] = useState<{ summary: string; json: string } | null>(null);
  const [appearance, setAppearance] = useState('light');
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (previewTimer.current) {
        clearTimeout(previewTimer.current);
      }
    };
  }, []);

  // Debounce the JSON preview: without this the whole example re-renders
  // (plus a JSON.stringify) on every keystroke.
  const handleChange = (editor: InkioEditor) => {
    if (previewTimer.current) {
      clearTimeout(previewTimer.current);
    }
    previewTimer.current = setTimeout(() => {
      previewTimer.current = null;
      if (editor.isDestroyed) return;
      const snapshot = editor.getJSON();
      setPreview({ summary: read(snapshot).summary(80), json: JSON.stringify(snapshot, null, 2) });
    }, 150);
  };

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
        <label className="appearance-picker">
          Editor theme
          <select value={appearance} onChange={(event) => setAppearance(event.target.value)}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="custom">Custom palette</option>
          </select>
        </label>
        <Editor
          placeholder="Write something..."
          content={content}
          theme={appearance === 'dark' ? 'dark' : 'light'}
          ui={{ className: appearance === 'custom' ? 'example-theme' : undefined }}
          onCreate={handleChange}
          onChange={handleChange}
        />
      </section>

      <section className="json-card">
        <div className="section-title">Document summary</div>
        <p>{preview?.summary}</p>
        <div className="section-title">JSON Output</div>
        <pre>{preview?.json}</pre>
      </section>
    </main>
  );
}
