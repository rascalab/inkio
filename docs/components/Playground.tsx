'use client';

import { useCallback, useId, useState } from 'react';
import EditorPane from './PlaygroundEditorPane';
import SimplePane from './PlaygroundSimplePane';
import type { PlaygroundLocale } from './playground-content';
import { TabPanel, Tabs } from './Tabs';
import './Playground.css';

const MODES = [
  { id: 'simple', label: 'Simple' },
  { id: 'editor', label: 'Editor' },
] as const;

type PlaygroundMode = (typeof MODES)[number]['id'];

const LOCALES: { id: PlaygroundLocale; label: string }[] = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
];

export default function Playground({ content }: { content?: string } = {}) {
  const modeId = useId();
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
      <header className="playground-header" lang="en">
        <div className="playground-header-left">
          <h1 className="playground-title">Inkio Playground</h1>
          <Tabs
            id={modeId}
            label="Playground mode"
            className="playground-mode-switch"
            buttonClassName="playground-mode-btn"
            items={MODES}
            value={mode}
            onChange={handleModeChange}
          />
        </div>
        <div className="playground-header-right">
          <div className="playground-mode-switch" role="group" aria-label="Editor language">
            {LOCALES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                lang={id}
                aria-pressed={locale === id}
                className="playground-mode-btn"
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

      <div className="playground-main">
        {/* Both editors stay mounted once opened so each keeps its own document and history. */}
        <TabPanel id={modeId} tab="simple" className="playground-pane" active={mode === 'simple'}>
          {simpleOpened && (
            <SimplePane content={content} locale={locale} active={mode === 'simple'} showViewer={showViewer} showJSON={showJSON} />
          )}
        </TabPanel>
        <TabPanel id={modeId} tab="editor" className="playground-pane" active={mode === 'editor'}>
          <EditorPane content={content} locale={locale} active={mode === 'editor'} showViewer={showViewer} showJSON={showJSON} />
        </TabPanel>
      </div>
    </div>
  );
}
