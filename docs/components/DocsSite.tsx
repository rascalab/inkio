import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { Search } from 'nextra/components';
import { Layout, Navbar } from 'nextra-theme-docs';
import { archiveSegment, getDocVersions } from './docs-versions';
import DocsThemeSwitch from './DocsThemeSwitch';
import DocsVersionSelect from './DocsVersionSelect';

const repository = 'https://github.com/rascalab/inkio';

const footer = (
  <footer className="inkio-site-footer">
    <div className="inkio-site-shell">
      <strong translate="no">inkio</strong>
      <nav aria-label="사이트 정보">
        <a href={`${repository}/tags`}>릴리스</a>
        <a href={repository}>GitHub</a>
        <a href={`${repository}/blob/main/LICENSE`}>MIT</a>
      </nav>
    </div>
  </footer>
);

export default async function DocsSite({ children, release }: { children: ReactNode; release?: string }) {
  const { pageMap, versions, currentPaths } = await getDocVersions();
  const archives = pageMap.find(item => 'children' in item && item.name === archiveSegment);
  const archive = archives && 'children' in archives
    ? archives.children.find(item => 'children' in item && item.name === release)
    : undefined;
  if (release && (!archive || !('children' in archive))) notFound();

  return (
    <Layout
      navbar={(
        <Navbar
          className="inkio-site-shell inkio-site-nav"
          align="left"
          logo={<span className="inkio-site-brand" translate="no"><span aria-hidden="true">i</span>inkio</span>}
          projectLink={repository}
        >
          {versions.length > 0 && (
            <DocsVersionSelect release={release} currentPaths={currentPaths} versions={versions} />
          )}
          <DocsThemeSwitch />
        </Navbar>
      )}
      footer={footer}
      pageMap={archive && 'children' in archive ? archive.children : pageMap.filter(item => item !== archives)}
      search={(
        <Search
          placeholder="문서 검색…"
          emptyResult="검색 결과가 없습니다."
          loading="검색 중…"
          errorText="검색 인덱스를 불러오지 못했습니다."
          searchOptions={{ filters: { version: release ?? 'current' } }}
        />
      )}
      darkMode={false}
      nextThemes={{ defaultTheme: 'dark' }}
      docsRepositoryBase={`${repository}/tree/main/docs`}
      sidebar={{ defaultMenuCollapseLevel: 1 }}
      toc={{ title: '목차', backToTop: '맨 위로' }}
      editLink={release ? null : '이 문서 편집'}
      feedback={{ content: release ? null : '문서 피드백' }}
    >
      {children}
    </Layout>
  );
}
