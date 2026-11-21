'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function DocsThemeSwitch() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <span className="inkio-site-theme-control">
      <select
        className="inkio-site-theme"
        aria-label="테마"
        value={mounted ? theme ?? 'dark' : 'dark'}
        onChange={(event) => setTheme(event.target.value)}
      >
        <option value="light">라이트</option>
        <option value="dark">다크</option>
        <option value="system">시스템</option>
      </select>
    </span>
  );
}
