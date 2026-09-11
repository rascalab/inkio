'use client';

import { useState } from 'react';
import { Editor } from '@inkio/editor';
import '@inkio/editor/style.css';
import './landing-page.css';

const INSTALL_CMDS = {
  pnpm: 'pnpm add @inkio/editor react react-dom',
  npm: 'npm install @inkio/editor react react-dom',
  yarn: 'yarn add @inkio/editor react react-dom',
} as const;

type PkgManager = keyof typeof INSTALL_CMDS;

const DEMO_DOC = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: '만져보세요, 진짜입니다' }],
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: '밑에 있는 게 진짜 에디터입니다. ' },
        { type: 'text', marks: [{ type: 'bold' }], text: '고쳐 쓰고' },
        { type: 'text', text: ', ' },
        { type: 'text', marks: [{ type: 'code' }], text: '/' },
        { type: 'text', text: ' 를 눌러 보세요.' },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '설치 30초' }] }],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '붙여넣기 10초' }] }],
        },
      ],
    },
    {
      type: 'codeBlock',
      attrs: { language: 'tsx' },
      content: [{ type: 'text', text: "<Editor initialContent=\"<p>Hello</p>\" />" }],
    },
  ],
};

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function LandingPage() {
  const [pm, setPm] = useState<PkgManager>('pnpm');
  return (
    <div className="lp">
      <header className="lp-nav">
        <a className="lp-brand" href="./">
          <span className="lp-brand-mark" aria-hidden="true" />
          <span>Inkio</span>
        </a>
        <nav className="lp-nav-links" aria-label="주요 링크">
          <a href="./getting-started">문서</a>
          <a href="./playground">플레이그라운드</a>
          <a href="./recipes/comments">댓글 연동</a>
          <a href="https://github.com/rascalab/inkio">GitHub</a>
        </nav>
        <a className="lp-nav-cta" href="./getting-started">시작하기</a>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-kicker">Tiptap 기반 · MIT 라이선스</p>
              <h1 className="lp-title">
                에디터는 그만 만들고,
                <br />
                <span className="lp-grad">제품을 만드세요.</span>
              </h1>
              <p className="lp-sub">
                Inkio는 겹겹이 쌓는 리치 텍스트 키트입니다. 가벼운 위지윅부터
                노션 스타일 풀 에디터, 브라우저 이미지 편집까지 — 필요한 것만 얹으세요.
              </p>
              <div className="lp-install">
                <div className="lp-pm-tabs" role="tablist" aria-label="패키지 매니저">
                  {(Object.keys(INSTALL_CMDS) as PkgManager[]).map((key) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={pm === key}
                      className={pm === key ? 'is-active' : undefined}
                      onClick={() => setPm(key)}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <code className="lp-install-cmd">{INSTALL_CMDS[pm]}</code>
              </div>
              <div className="lp-hero-actions">
                <a className="lp-btn-primary" href="./getting-started">5분 안에 붙이기</a>
                <a className="lp-btn-ghost" href="./playground">직접 만져보기</a>
              </div>
              <dl className="lp-stats">
                <div><dt>패키지</dt><dd>5</dd></div>
                <div><dt>타입</dt><dd>TS 우선</dd></div>
                <div><dt>렌더링</dt><dd>SSR 대응</dd></div>
                <div><dt>라이선스</dt><dd>MIT</dd></div>
              </dl>
            </div>
            <div className="lp-hero-demo">
              <div className="lp-window dark">
                <div className="lp-window-bar" aria-hidden="true">
                  <span /><span /><span />
                  <em>demo.tsx — live</em>
                </div>
                <Editor initialContent={DEMO_DOC as never} theme="dark" />
              </div>
            </div>
          </div>
        </section>

        <section className="lp-section">
          <h2 className="lp-h2">필요한 것만 얹으세요</h2>
          <div className="lp-bento">
            <a className="lp-card lp-span2" href="./getting-started">
              <span className="lp-card-ic"><Icon d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></span>
              <h3>@inkio/editor — 노션 스타일</h3>
              <p>슬래시 메뉴, 블록 핸들, 버블·플로팅 메뉴. advanced 전체 포함.</p>
              <span className="lp-card-go">문서 보기 →</span>
            </a>
            <a className="lp-card" href="./image-editor">
              <span className="lp-card-ic"><Icon d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /></span>
              <h3>이미지 에디터</h3>
              <p>크롭·필터·모자이크·스티커. 서버 없이 브라우저에서.</p>
              <span className="lp-card-go">문서 보기 →</span>
            </a>
            <a className="lp-card" href="./recipes/comments">
              <span className="lp-card-ic"><Icon d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></span>
              <h3>댓글·멘션</h3>
              <p>스레드 4개 콜백으로 서버 연동. 레시피 포함.</p>
              <span className="lp-card-go">레시피 보기 →</span>
            </a>
            <a className="lp-card" href="./serialization">
              <span className="lp-card-ic"><Icon d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></span>
              <h3>마크다운 입출력</h3>
              <p><kbd>/markdown</kbd> 서브패스. 번들에 remark를 끌고 오지 않음.</p>
              <span className="lp-card-go">문서 보기 →</span>
            </a>
            <a className="lp-card" href="./components">
              <span className="lp-card-ic"><Icon d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></span>
              <h3>가벼운 읽기 전용</h3>
              <p>엔진 없는 <kbd>StaticViewer</kbd>. 목록·SEO용.</p>
              <span className="lp-card-go">문서 보기 →</span>
            </a>
          </div>
        </section>

        <section className="lp-final">
          <h2 className="lp-h2">붙여넣으면 끝입니다.</h2>
          <div className="lp-hero-actions lp-center">
            <a className="lp-btn-primary" href="./getting-started">문서 읽기</a>
            <a className="lp-btn-ghost" href="https://github.com/rascalab/inkio">GitHub에서 보기</a>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <span>Inkio — MIT licensed.</span>
        <span>Tiptap · ProseMirror 위에서 동작합니다.</span>
      </footer>
    </div>
  );
}
