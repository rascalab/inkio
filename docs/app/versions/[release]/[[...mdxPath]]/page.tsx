import { importPage } from 'nextra/pages';
import DocsArticle from '../../../../components/DocsArticle';
import { archiveSegment, listMdxPaths } from '../../../../components/docs-versions';

type PageProps = { params: Promise<{ release: string; mdxPath?: string[] }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listMdxPaths())
    .filter(([section]) => section === archiveSegment)
    .map(([, release, ...mdxPath]) => ({ release, mdxPath }));
}

export async function generateMetadata({ params }: PageProps) {
  const { release, mdxPath = [] } = await params;
  const { metadata } = await importPage([archiveSegment, release, ...mdxPath]);
  return { ...metadata, title: `${metadata.title} · ${release}` };
}

export default async function ArchivePage({ params }: PageProps) {
  const { release, mdxPath = [] } = await params;
  return <DocsArticle path={mdxPath} release={release} />;
}
