'use client';

import { useCallback, useState } from 'react';
import EditorPane from './PlaygroundEditorPane';
import SimplePane from './PlaygroundSimplePane';
import type { PlaygroundLocale } from './playground-content';
import './Playground.css';

type PlaygroundMode = 'editor' | 'simple';

const LOCALES: { id: PlaygroundLocale; label: string }[] = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
];

export default function Playground({ content }: { content?: string } = {}) {
  const [mode, setMode] = useState<PlaygroundMode>('editor');
  const [locale, setLocale] = useState<PlaygroundLocale>('ko');
  const [showViewer, setShowViewer] = useState(true);
  const [showJSON, setShowJSON] = useState(true);

  const [simpleOpened, setSimpleOpened] = useState(false);

  const handleModeChange = useCallback((nextMode: PlaygroundMode) => {
    setMode(nextMode);
    if (nextMode === 'simple') setSimpleOpened(true);
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
          <div className="playground-mode-switch" role="group" aria-label="Editor language">
            {LOCALES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={locale === id}
                className={`playground-mode-btn${locale === id ? ' is-active' : ''}`}
                onClick={() => setLocale(id)}
              >
                {label}
              </button>
            ))}
          </div>
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
        {/* Both stay mounted once opened, so each tab keeps what was written in it. */}
        {simpleOpened && (
          <div className="playground-pane" hidden={mode !== 'simple'}>
            <SimplePane content={content} locale={locale} showViewer={showViewer} showJSON={showJSON} />
          </div>
        )}
        <div className="playground-pane" hidden={mode !== 'editor'}>
          <EditorPane content={content} locale={locale} showViewer={showViewer} showJSON={showJSON} />
        </div>
      </main>
    </div>
  );
}
