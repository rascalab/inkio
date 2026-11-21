import type { ReactNode } from 'react';
import DocsSite from '../../../components/DocsSite';

export default async function ArchiveLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ release: string }>;
}) {
  const { release } = await params;
  return <DocsSite release={release}>{children}</DocsSite>;
}
