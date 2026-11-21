import { importPage } from 'nextra/pages';
import DocsArticle from '../../../components/DocsArticle';
import { listMdxPaths } from '../../../components/docs-versions';

export async function generateStaticParams() {
  return (await listMdxPaths())
    .filter(([section]) => section !== 'versions')
    .map(mdxPath => ({ mdxPath }));
}

export async function generateMetadata(props: PageProps) {
  const params = await props.params;
  const path = params.mdxPath ?? [];
  try {
    const { metadata } = await importPage(path);
    return metadata;
  } catch {
    return {};
  }
}

type PageProps = {
  params: Promise<{ mdxPath?: string[] }>;
};

export default async function Page(props: PageProps) {
  const { mdxPath } = await props.params;
  return <DocsArticle path={mdxPath ?? []} />;
}

