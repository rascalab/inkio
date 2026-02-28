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
  const { resolvedTheme } = useTheme();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!containerRef.current || loaded) return;

    const projectFiles = { ...files };
    if (!projectFiles['package.json']) {
      projectFiles['package.json'] = JSON.stringify(
        { name: title, private: true, dependencies: {} },
        null,
        2,
      );
    }

    import('@stackblitz/sdk').then(({ default: sdk }) => {
      if (!containerRef.current) return;
      sdk.embedProject(
        containerRef.current,
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
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
