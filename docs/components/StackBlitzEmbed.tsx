'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';

export type StackBlitzProject = {
  title: string;
  files: Record<string, string>;
  openFile?: string;
};

function StackBlitzEmbedInner({ title, files, openFile }: StackBlitzProject) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const { resolvedTheme } = useTheme();
  // Depend on serialized content, not object identity: callers may pass
  // inline literals, and identity deps would re-embed every render.
  const filesKey = JSON.stringify(files);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    const projectFiles: Record<string, string> = JSON.parse(filesKey);
    if (!projectFiles['package.json']) {
      projectFiles['package.json'] = JSON.stringify(
        { name: title, private: true, dependencies: {} },
        null,
        2,
      );
    }

    import('@stackblitz/sdk').then(({ default: sdk }) => {
      if (cancelled || containerRef.current !== container) return;
      // Clear any previous embed first: the SDK exposes no destroy, so
      // removing the iframe DOM is the teardown.
      container.replaceChildren();
      sdk.embedProject(
        container,
        {
          title,
          description: `Inkio ${title} example`,
          template: 'node',
          files: projectFiles,
        },
        {
          clickToLoad: true,
          openFile: openFile ?? 'src/App.tsx',
          theme: resolvedTheme === 'dark' ? 'dark' : 'light',
          height: 500,
          view: 'editor',
        },
      );
    }).catch(() => {
      // Chunk/SDK load failure must not end as an unhandled rejection with
      // an empty frame: show the failure in place of the embed.
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [title, filesKey, openFile, resolvedTheme]);

  if (failed) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: 500,
          borderRadius: '0.5rem',
          border: '1px solid var(--inkio-border, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
          fontSize: 14,
        }}
      >
        Failed to load StackBlitz. Check your connection and try again.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        minHeight: 500,
        borderRadius: '0.5rem',
        overflow: 'hidden',
        border: '1px solid var(--inkio-border, #e5e7eb)',
      }}
    />
  );
}

// Re-export with dynamic import to avoid SSR issues
export default function StackBlitzEmbed(props: StackBlitzProject) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        style={{
          width: '100%',
          minHeight: 500,
          borderRadius: '0.5rem',
          border: '1px solid var(--inkio-border, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
          fontSize: 14,
        }}
      >
        Loading StackBlitz...
      </div>
    );
  }

  return <StackBlitzEmbedInner {...props} />;
}
