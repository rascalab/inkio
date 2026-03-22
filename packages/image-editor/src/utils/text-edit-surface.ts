interface TextEditSurface {
  background: string;
  border: string;
  chrome: string;
  shadow: string;
}

type ThemeMode = 'light' | 'dark';

const LIGHT_SURFACE: TextEditSurface = {
  background: 'rgba(255, 250, 245, 0.82)',
  border: 'rgba(15, 23, 42, 0.12)',
  chrome: '#0f172a',
  shadow: '0 16px 36px rgba(15, 23, 42, 0.16)',
};

const DARK_SURFACE: TextEditSurface = {
  background: 'rgba(15, 23, 42, 0.78)',
  border: 'rgba(255, 255, 255, 0.18)',
  chrome: '#f8fafc',
  shadow: '0 18px 40px rgba(2, 6, 23, 0.34)',
};

function resolveThemeMode(): ThemeMode {
  if (typeof document === 'undefined') {
    return 'light';
  }

  const themeRoot = document.querySelector('.inkio-ie-modal-content[data-theme]')
    ?? document.querySelector('.inkio-ie-portal-theme[data-theme]')
    ?? document.querySelector('.inkio[data-theme]')
    ?? document.querySelector('.inkio');
  const explicitTheme = themeRoot?.getAttribute('data-theme');
  if (explicitTheme === 'light' || explicitTheme === 'dark') {
    return explicitTheme;
  }

  return 'light';
}

export function getTextEditSurface(themeMode: ThemeMode = resolveThemeMode()): TextEditSurface {
  return themeMode === 'dark' ? DARK_SURFACE : LIGHT_SURFACE;
}
