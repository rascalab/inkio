'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
] as const;

export default function DocsThemeSwitch() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted ? theme ?? 'system' : 'system';

  return (
    <div className="x:flex x:items-center x:gap-1" aria-label="Theme switcher">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setTheme(option.id)}
          aria-pressed={activeTheme === option.id}
          className={[
            'x:cursor-pointer x:rounded-md x:px-2 x:py-1 x:text-xs x:font-medium x:transition-colors',
            activeTheme === option.id
              ? 'x:bg-gray-200 x:text-gray-900 x:dark:bg-primary-100/10 x:dark:text-gray-50'
              : 'x:text-gray-600 x:hover:bg-gray-200 x:hover:text-gray-900 x:dark:text-gray-400 x:dark:hover:bg-primary-100/5 x:dark:hover:text-gray-50',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
