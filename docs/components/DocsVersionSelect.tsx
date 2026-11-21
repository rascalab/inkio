'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { DocVersion } from './docs-versions';

type Props = {
  release?: string;
  currentRelease: string;
  currentPaths: string[];
  versions: DocVersion[];
};

export default function DocsVersionSelect({ release, currentRelease, currentPaths, versions }: Props) {
  const pathname = usePathname();
  const page = pathname.split('/').filter(Boolean).slice(release ? 2 : 0).join('/');

  function address(paths: string[], base = '') {
    const destination = paths.includes(page) ? page : paths.includes('getting-started') ? 'getting-started' : '';
    return `${base}/${destination ? `${destination}/` : ''}`;
  }

  return (
    <details
      className="inkio-docs-version"
      key={pathname}
      onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }}
      onKeyDown={event => {
        if (event.key !== 'Escape' || !event.currentTarget.open) return;
        event.stopPropagation();
        event.currentTarget.open = false;
        event.currentTarget.querySelector('summary')?.focus();
      }}
    >
      <summary className="inkio-site-select inkio-site-select-control" aria-label={`문서 버전: ${release ?? currentRelease}`}>
        <span translate="no">{release ?? currentRelease}</span>
      </summary>
      <nav className="inkio-docs-version-menu" aria-label="문서 버전">
        <span>최신 문서</span>
        <Link href={address(currentPaths)} prefetch={false} aria-current={release ? undefined : 'true'} translate="no">
          {currentRelease}
        </Link>
        <span>릴리스 당시 문서</span>
        {versions.map(version => (
          <Link
            key={version.release}
            href={address(version.paths, `/versions/${version.release}`)}
            prefetch={false}
            aria-current={release === version.release ? 'true' : undefined}
            translate="no"
          >
            {version.release}
          </Link>
        ))}
      </nav>
    </details>
  );
}
