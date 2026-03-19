'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import './Playground.css';

type PlaygroundMode = 'editor' | 'simple';

const EditorPane = dynamic(() => import('./PlaygroundEditorPane'), {
  loading: () => <div className="playground-loading">Loading editor...</div>,
});

const SimplePane = dynamic(() => import('./PlaygroundSimplePane'), {
  loading: () => <div className="playground-loading">Loading editor...</div>,
});

export default function Playground({ initialContent }: { initialContent?: string } = {}) {
  const [mode, setMode] = useState<PlaygroundMode>('editor');
  const [showViewer, setShowViewer] = useState(true);
  const [showJSON, setShowJSON] = useState(true);

  const handleModeChange = useCallback((nextMode: PlaygroundMode) => {
    setMode(nextMode);
  }, []);

  return (
    <div className="inkio playground-root">
      <header className="playground-header">
        <div className="playground-header-left">
          <h1 className="playground-title">Inkio Playground</h1>
          <div className="playground-mode-switch">
            <button
              type="button"
              className={`playground-mode-btn${mode === 'simple' ? ' is-active' : ''}`}
              onClick={() => handleModeChange('simple')}
            >
              Simple
            </button>
            <button
              type="button"
              className={`playground-mode-btn${mode === 'editor' ? ' is-active' : ''}`}
              onClick={() => handleModeChange('editor')}
            >
              Editor
            </button>
          </div>
        </div>
        <div className="playground-header-right">
          <label className="playground-toggle-label">
            <input
              type="checkbox"
              checked={showViewer}
              onChange={() => setShowViewer((value) => !value)}
              className="playground-toggle-input"
            />
            <span>Viewer</span>
          </label>
          <label className="playground-toggle-label">
            <input
              type="checkbox"
              checked={showJSON}
              onChange={() => setShowJSON((value) => !value)}
              className="playground-toggle-input"
            />
            <span>JSON</span>
          </label>
        </div>
      </header>

      <main className="playground-main">
        {mode === 'simple' ? (
          <SimplePane
            key="simple"
            initialContent={initialContent}
            showViewer={showViewer}
            showJSON={showJSON}
          />
        ) : (
          <EditorPane
            key="editor"
            initialContent={initialContent}
            showViewer={showViewer}
            showJSON={showJSON}
          />
        )}
      </main>
    </div>
  );
}
