import type { ReactNode } from 'react';
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'><text y='32' font-size='32'>📝</text></svg>" />
      </head>
      <body className="inkio inkio-docs-root" style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
