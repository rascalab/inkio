import { getPageMap } from 'nextra/page-map';
import { generateStaticParamsFor } from 'nextra/pages';
import manifest from '../package.json';

export const currentRelease = `v${manifest.version}`;
export const archiveSegment = 'versions';

export type DocVersion = { release: string; paths: string[] };

const getStaticParams = generateStaticParamsFor('mdxPath');

export async function listMdxPaths(): Promise<string[][]> {
  return (await getStaticParams()).map(({ mdxPath }) => mdxPath as string[]);
}

export async function getDocVersions() {
  const pageMap = await getPageMap();
  const archives = new Map<string, string[]>();
  const currentPaths: string[] = [];
  for (const [section, release, ...rest] of await listMdxPaths()) {
    if (section !== archiveSegment) {
      currentPaths.push([section, release, ...rest].filter(Boolean).join('/'));
    } else if (release) {
      let paths = archives.get(release);
      if (!paths) archives.set(release, paths = []);
      paths.push(rest.join('/'));
    }
  }
  const versions: DocVersion[] = Array.from(archives, ([release, paths]) => ({ release, paths }));
  versions.sort((a, b) => b.release.localeCompare(a.release, 'en', { numeric: true }));
  return { pageMap, versions, currentPaths };
}
