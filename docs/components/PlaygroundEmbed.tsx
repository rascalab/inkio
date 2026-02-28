'use client';

import dynamic from 'next/dynamic';

const Playground = dynamic(() => import('./Playground'), {
  ssr: false,
  loading: () => <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>로딩 중...</div>,
});

export default function PlaygroundEmbed() {
  return <Playground />;
}
