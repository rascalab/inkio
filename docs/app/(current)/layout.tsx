import type { ReactNode } from 'react';
import DocsSite from '../../components/DocsSite';

export default function CurrentDocsLayout({ children }: { children: ReactNode }) {
  return <DocsSite>{children}</DocsSite>;
}
