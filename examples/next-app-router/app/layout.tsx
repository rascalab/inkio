import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@inkio/editor/minimal.css';
import '@inkio/image-editor/style.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Inkio Next.js Example',
  description: 'Example Inkio integration for the Next.js App Router',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
