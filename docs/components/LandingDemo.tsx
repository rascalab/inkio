'use client';

import type { Editor as EditorComponent } from '@inkio/editor';
import { useRef, useState } from 'react';

type DemoEditor = typeof EditorComponent;

const DEMO_TITLE = '릴리스 체크리스트';
const DEMO_CODE = '<Editor content="<p>안녕하세요.</p>" />';
const DEMO_TASKS = [
  { checked: true, text: '설치 가이드 업데이트' },
  { checked: false, text: '모바일에서 편집 확인' },
];
const DEMO_DOC = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: DEMO_TITLE }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '항목을 체크하거나 ' },
        { type: 'text', marks: [{ type: 'code' }], text: '/' },
        { type: 'text', text: '를 입력해 새 블록을 추가해 보세요.' },
      ],
    },
    {
      type: 'taskList',
      content: DEMO_TASKS.map(({ checked, text }) => ({
        type: 'taskItem',
        attrs: { checked },
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      })),
    },
    {
      type: 'codeBlock',
      attrs: { language: 'tsx' },
      content: [{ type: 'text', text: DEMO_CODE }],
    },
  ],
};

export default function LandingDemo() {
  const [Editor, setEditor] = useState<DemoEditor>();
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const windowRef = useRef<HTMLDivElement>(null);

  async function startDemo(button: HTMLButtonElement) {
    if (loadStatus === 'loading') return;
    setLoadStatus('loading');
    try {
      // A static import would load the editor before the visitor opens the demo.
      const { Editor } = await import('@inkio/editor');
      // Keep focus in the demo while its editable surface mounts, but don't
      // pull it back if the visitor navigated away during the download.
      if (button.ownerDocument.activeElement === button) {
        windowRef.current?.focus({ preventScroll: true });
      }
      setEditor(() => Editor);
      setLoadStatus('idle');
    } catch {
      setLoadStatus('error');
    }
  }

  return (
    <div className="lp-hero-demo" id="demo" tabIndex={-1}>
      <div className="lp-stage-rail" aria-hidden="true">
        <span>블록 에디터 데모</span><span translate="no">@inkio/editor</span>
      </div>
      <div className="lp-window" ref={windowRef} tabIndex={-1}>
        <div className="lp-window-bar">
          <span>release-notes.md</span>
          <span className="lp-window-mode">{Editor ? '편집 중' : '미리보기'}</span>
        </div>
        {Editor ? (
          <Editor
            content={DEMO_DOC}
            locale="ko"
            onCreate={(editor) => {
              const demoWindow = windowRef.current;
              if (demoWindow && demoWindow.ownerDocument.activeElement === demoWindow) {
                editor.commands.focus('start');
              }
            }}
          />
        ) : (
          <div className="lp-demo-preview inkio inkio-editor inkio-container-default">
            <div className="inkio-content">
              <h2>{DEMO_TITLE}</h2>
              <p>항목을 체크하거나 <code>/</code>를 입력해 새 블록을 추가해 보세요.</p>
              <ul className="lp-demo-tasks">
                {DEMO_TASKS.map(({ checked, text }) => (
                  <li key={text}>
                    <span className="lp-demo-check" aria-hidden="true"><span>{checked ? '✓' : ''}</span></span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <pre><code>{DEMO_CODE}</code></pre>
              <button
                type="button"
                className="lp-btn-ghost lp-demo-start"
                aria-disabled={loadStatus === 'loading'}
                onClick={(event) => void startDemo(event.currentTarget)}
              >
                {loadStatus === 'error' ? '다시 시도' : '편집 시작'}
              </button>
              <p className="lp-demo-status" role="status">
                {loadStatus === 'loading' && '에디터를 불러오는 중…'}
                {loadStatus === 'error' && '에디터를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도하세요.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
