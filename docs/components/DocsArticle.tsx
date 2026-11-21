import type { ComponentProps } from 'react';
import { importPage } from 'nextra/pages';
import { useMDXComponents } from '../mdx-components';
import { archiveSegment, getDocVersions } from './docs-versions';

const { a: Anchor, wrapper: Wrapper } = useMDXComponents();

export default async function DocsArticle({ path, release }: { path: string[]; release?: string }) {
  const prefix = release ? `/${archiveSegment}/${release}` : '';
  const { default: Content, ...pageProps } = await importPage(release ? [archiveSegment, release, ...path] : path);
  const paths = release ? (await getDocVersions()).versions.find(version => version.release === release)?.paths : undefined;

  function ArchivedLink({ href, children, ...props }: ComponentProps<typeof Anchor>) {
    if (typeof href !== 'string' || !href || href.startsWith('#') || href.startsWith(`/${archiveSegment}/`) || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) {
      return <Anchor href={href} {...props}>{children}</Anchor>;
    }
    const url = new URL(href, `https://docs.invalid/${path.join('/')}`);
    const slug = url.pathname.replace(/^\/+|\/+$/g, '');
    if (!paths?.includes(slug)) return <span>{children}</span>;
    return <Anchor href={`${prefix}/${slug ? `${slug}/` : ''}${url.search}${url.hash}`} {...props}>{children}</Anchor>;
  }

  return (
    <div className="inkio-docs-layout" data-pagefind-filter={`version:${release ?? 'current'}`}>
      <Wrapper {...pageProps}>
        {release && <p className="inkio-docs-archive-label" data-pagefind-ignore>릴리스 보관본 <strong>{release}</strong></p>}
        <Content components={release ? { a: ArchivedLink } : undefined} />
      </Wrapper>
    </div>
  );
}
