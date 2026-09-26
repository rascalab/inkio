'use client';

import { useCallback, useState } from 'react';
import EditorPane from './PlaygroundEditorPane';
import SimplePane from './PlaygroundSimplePane';
import './Playground.css';

type PlaygroundMode = 'editor' | 'simple';

export default function Playground({ content }: { content?: string } = {}) {
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
          <div className="playground-mode-switch" role="tablist" aria-label="Playground mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'simple'}
              className={`playground-mode-btn${mode === 'simple' ? ' is-active' : ''}`}
              onClick={() => handleModeChange('simple')}
            >
              Simple
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'editor'}
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
            content={content}
            showViewer={showViewer}
            showJSON={showJSON}
          />
        ) : (
          <EditorPane
            key="editor"
            content={content}
            showViewer={showViewer}
            showJSON={showJSON}
          />
        )}
      </main>
    </div>
  );
}
