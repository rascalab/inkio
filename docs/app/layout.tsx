import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import { Search } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import { Layout, Navbar } from 'nextra-theme-docs';
import DocsThemeSwitch from '../components/DocsThemeSwitch';
import 'nextra-theme-docs/style.css';
import '@inkio/editor/style.css';
import '@inkio/image-editor/style.css';
import './docs-theme-overrides.css';

export const metadata = {
  title: {
    default: 'Inkio',
    template: '%s - Inkio',
  },
  description: 'A customizable React rich text editor toolkit',
};

// Unmodified WOFF2 from https://seed.line.me/index_kr.html (SIL OFL 1.1).
const lineSeedKr = localFont({
  src: [
    { path: './fonts/LINESeedKR-Rg.woff2', weight: '400' },
    { path: './fonts/LINESeedKR-Bd.woff2', weight: '700' },
  ],
  variable: '--site-sans',
  display: 'swap',
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
});

const repository = 'https://github.com/rascalab/inkio';

const navbar = (
  <Navbar
    className="inkio-site-shell inkio-site-nav"
    align="left"
    logo={<span className="inkio-site-brand" translate="no"><span aria-hidden="true">i</span>Inkio</span>}
    projectLink={repository}
  >
    <DocsThemeSwitch />
  </Navbar>
);

const footer = (
  <footer className="inkio-site-footer">
    <div className="inkio-site-shell">
      <span><strong translate="no">Inkio</strong> · MIT 라이선스</span>
      <span>Tiptap · ProseMirror 기반</span>
      <a href="https://seed.line.me/" translate="no">LINE Seed KR</a>
      <a href={repository} translate="no">GitHub ↗</a>
    </div>
  </footer>
);

export default async function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='5' fill='%23c8f774'/%3E%3Cpath fill='%23080e0e' d='M11 5h2v2h-2zm-2 4h4v8h3v2H9v-2h2v-6H9z'/%3E%3C/svg%3E" />
      </head>
      <body className={`inkio inkio-docs-root ${lineSeedKr.variable}`}>
        <Layout
          navbar={navbar}
          footer={footer}
          pageMap={await getPageMap()}
          search={<Search placeholder="문서 검색…" emptyResult="검색 결과가 없습니다." loading="검색 중…" errorText="검색 인덱스를 불러오지 못했습니다." />}
          darkMode={false}
          nextThemes={{ defaultTheme: 'dark' }}
          docsRepositoryBase={`${repository}/tree/main/docs`}
          sidebar={{ defaultMenuCollapseLevel: 1 }}
          toc={{ title: '목차', backToTop: '맨 위로' }}
          editLink="이 문서 편집"
          feedback={{ content: '문서 피드백' }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
