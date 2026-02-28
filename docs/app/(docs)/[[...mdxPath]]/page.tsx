import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents } from '../../../mdx-components';
import { notFound } from 'next/navigation';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

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
  const params = await props.params;
  const path = params.mdxPath ?? [];
  let result;
  try {
    result = await importPage(path);
  } catch {
    notFound();
  }
  const { default: MDXContent, ...pageProps } = result;
  const Wrapper = useMDXComponents().wrapper;

  return (
    <Wrapper {...pageProps}>
      <MDXContent />
    </Wrapper>
  );
}

