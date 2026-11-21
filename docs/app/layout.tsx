import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import 'nextra-theme-docs/style.css';
import '@inkio/editor/style.css';
import '@inkio/image-editor/style.css';
import './docs-theme-overrides.css';

export const metadata = {
  title: {
    default: 'Inkio',
    template: '%s - Inkio',
  },
  description: 'A customizable React rich text editor toolkit',
};

// Unmodified WOFF2 from https://seed.line.me/index_kr.html (SIL OFL 1.1).
const lineSeedKr = localFont({
  src: [
    { path: './fonts/LINESeedKR-Rg.woff2', weight: '400' },
    { path: './fonts/LINESeedKR-Bd.woff2', weight: '700' },
  ],
  variable: '--site-sans',
  display: 'swap',
  preload: false,
  fallback: ['system-ui', 'sans-serif'],
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='5' fill='%23c8f774'/%3E%3Cpath fill='%23080e0e' d='M11 5h2v2h-2zm-2 4h4v8h3v2H9v-2h2v-6H9z'/%3E%3C/svg%3E" />
      </head>
      <body className={`inkio inkio-docs-root ${lineSeedKr.variable}`}>
        {children}
      </body>
    </html>
  );
}
