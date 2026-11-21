'use client';

import dynamic from 'next/dynamic';

// Nextra shares its catch-all route across all MDX pages. Keep the editors
// out of that route's initial client graph, including links from the landing.
const Playground = dynamic(() => import('./Playground'), {
  ssr: false,
  loading: () => <p className="playground-loading" role="status">플레이그라운드를 불러오는 중…</p>,
});

export default function PlaygroundEmbed() {
  return <Playground />;
}
