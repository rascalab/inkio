import Link from 'next/link';
import { SkipNavContent } from 'nextra/components';
import LandingDemo from './LandingDemo';
import LandingInstall from './LandingInstall';
import './landing-page.css';

const GUIDES = [
  { title: '문서 편집', label: 'Editor', detail: '기본 툴바가 있는 Simple과 슬래시 메뉴·블록 이동이 있는 Editor를 비교하세요.', href: '/components' },
  { title: '이미지 편집', label: 'Canvas', detail: '문서에 넣은 이미지를 브라우저에서 자르고, 필터나 주석을 적용합니다.', href: '/image-editor' },
  { title: '실시간 공동 편집', label: 'Yjs', detail: '여러 사람이 같은 문서를 편집하고 서로의 커서를 볼 수 있도록 연결합니다.', href: '/collaboration' },
  { title: '댓글과 멘션', label: 'Review', detail: '선택한 문장에 댓글을 달고, 앱의 사용자 목록과 댓글 저장소를 연결합니다.', href: '/recipes/comments' },
  { title: '마크다운 가져오기·내보내기', label: 'Markdown', detail: 'Markdown 어댑터는 필요한 화면에서만 불러올 수 있습니다.', href: '/serialization' },
  { title: '읽기 전용 문서', label: 'Viewer', detail: 'StaticViewer로 편집 엔진을 불러오지 않고 저장한 문서를 표시합니다.', href: '/components#inkiocore--staticviewer-읽기-전용-경량-경로' },
];

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true">
      <path d={diagonal ? 'M4 12 12 4M4 4h8v8' : 'M2 8h11M8 3l5 5-5 5'} />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="lp">
      <main>
        <SkipNavContent />
        <section className="lp-hero-grid inkio-site-shell" aria-labelledby="lp-title">
          <div className="lp-hero-copy">
            <p className="lp-kicker">오픈소스 React SDK</p>
            <h1 className="lp-title" id="lp-title">React용<br />문서 에디터</h1>
            <p className="lp-sub">
              기본 툴바가 있는 에디터와 노션처럼 블록을 옮기는 에디터 중 하나를 고르세요.
              메뉴와 도구는 앱에 맞게 바꿀 수 있습니다.
            </p>
            <div className="lp-actions">
              <Link className="lp-btn-primary" href="/getting-started" prefetch={false}>설치 가이드 <Arrow /></Link>
              <a className="lp-btn-ghost" href="#demo">직접 편집해 보기</a>
            </div>
            <dl className="lp-stats">
              <div><dt>프리셋</dt><dd>2종</dd></div>
              <div><dt>문서 포맷</dt><dd>HTML · JSON</dd></div>
              <div><dt>서버 렌더링</dt><dd>SSR 지원</dd></div>
              <div><dt>라이선스</dt><dd>MIT</dd></div>
            </dl>
          </div>
          <LandingDemo />
        </section>

        <div className="lp-band" id="toolkit">
          <section className="lp-section inkio-site-shell" aria-labelledby="lp-toolkit-title">
            <div className="lp-section-intro">
              <p className="lp-kicker">01 / 기능 가이드</p>
              <h2 className="lp-h2" id="lp-toolkit-title">에디터와 확장 기능</h2>
              <p>편집기를 고른 뒤 프로젝트에 필요한 기능의 설정 방법을 확인하세요.</p>
            </div>
            <ol className="lp-guide-list">
              {GUIDES.map(({ title, label, detail, href }) => (
                <li key={label}>
                  <Link className="lp-guide" href={href} prefetch={false}>
                    <span className="lp-guide-label" aria-hidden="true">{label}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{detail}</p>
                    </div>
                    <Arrow diagonal />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="lp-section inkio-site-shell" aria-labelledby="lp-install-title">
          <div className="lp-section-intro">
            <p className="lp-kicker">02 / 시작하기</p>
            <h2 className="lp-h2" id="lp-install-title">React 프로젝트에 설치</h2>
            <p>아래 명령은 블록 에디터를 설치합니다. 클래식 툴바를 원한다면 <code>@inkio/simple</code>을 선택하세요.</p>
          </div>
          <div>
            <LandingInstall />
            <div className="lp-actions">
              <Link className="lp-btn-primary" href="/getting-started" prefetch={false}>앱에 연결하기 <Arrow /></Link>
              <Link className="lp-text-link" href="/troubleshooting" prefetch={false}>문제 해결 <Arrow diagonal /></Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
