const LOCALE_HEADER_SPLIT = /\s*,\s*/;
const LOCALE_Q_VALUE = /;\s*q\s*=\s*([01](?:\.\d+)?)\s*$/i;
const SIMPLE_LOCALE = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

interface WeightedLocale {
  locale: string;
  q: number;
  order: number;
}

function clampQuality(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function canonicalizeLocale(raw: string): string | null {
  const normalized = raw.trim().replace(/_/g, '-');
  if (!normalized || normalized === '*') {
    return null;
  }

  try {
    const canonical = Intl.getCanonicalLocales(normalized)[0];
    return canonical ?? null;
  } catch {
    if (!SIMPLE_LOCALE.test(normalized)) {
      return null;
    }

    const parts = normalized.split('-').filter(Boolean);
    if (parts.length === 0) {
      return null;
    }

    return parts
      .map((part, index) => {
        if (index === 0) {
          return part.toLowerCase();
        }

        if (/^\d+$/.test(part)) {
          return part;
        }

        if (part.length === 2) {
          return part.toUpperCase();
        }

        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join('-');
  }
}

function appendLocale(candidates: string[], locale: string) {
  if (!candidates.includes(locale)) {
    candidates.push(locale);
  }

  const language = locale.split('-')[0];
  if (language && language !== locale && !candidates.includes(language)) {
    candidates.push(language);
  }
}

function parseAcceptLanguage(raw: string): string[] {
  const weighted: WeightedLocale[] = raw
    .split(LOCALE_HEADER_SPLIT)
    .map((entry, index) => {
      const qualityMatch = entry.match(LOCALE_Q_VALUE);
      const localePart = qualityMatch ? entry.slice(0, qualityMatch.index).trim() : entry.trim();
      const quality = qualityMatch ? clampQuality(Number.parseFloat(qualityMatch[1])) : 1;
      return { locale: localePart, q: quality, order: index };
    })
    .filter((entry) => entry.locale.length > 0)
    .sort((a, b) => {
      if (b.q !== a.q) {
        return b.q - a.q;
      }

      return a.order - b.order;
    });

  const candidates: string[] = [];
  weighted.forEach((entry) => {
    const canonical = canonicalizeLocale(entry.locale);
    if (canonical) {
      appendLocale(candidates, canonical);
    }
  });

  return candidates;
}

function readLocaleLikeObject(input: Record<string, unknown>): unknown[] {
  const candidates: unknown[] = [];

  const iteratorFactory = (input as { [Symbol.iterator]?: unknown })[Symbol.iterator];
  if (typeof iteratorFactory === 'function') {
    try {
      const iterator = (iteratorFactory as () => Iterator<unknown>).call(input);
      let iteration = iterator.next();
      while (!iteration.done) {
        candidates.push(iteration.value);
        iteration = iterator.next();
      }
      return candidates;
    } catch {
      // Ignore iterator failures and continue with key-based heuristics.
    }
  }

  const keyed = ['locale', 'locales', 'language', 'lang'];
  keyed.forEach((key) => {
    if (key in input) {
      candidates.push(input[key]);
    }
  });

  if (candidates.length === 0 && typeof input.toString === 'function') {
    const asString = input.toString();
    if (asString && asString !== '[object Object]') {
      candidates.push(asString);
    }
  }

  return candidates;
}

function collectLocaleCandidates(input: unknown, out: string[]) {
  if (input == null) {
    return;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    const looksLikeHeader = trimmed.includes(',') || /;\s*q\s*=\s*/i.test(trimmed);
    const locales = looksLikeHeader ? parseAcceptLanguage(trimmed) : [trimmed];
    locales.forEach((locale) => {
      const canonical = canonicalizeLocale(locale);
      if (canonical) {
        appendLocale(out, canonical);
      }
    });
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((value) => collectLocaleCandidates(value, out));
    return;
  }

  if (typeof Intl !== 'undefined' && typeof Intl.Locale !== 'undefined' && input instanceof Intl.Locale) {
    collectLocaleCandidates(input.toString(), out);
    return;
  }

  if (typeof input === 'object') {
    readLocaleLikeObject(input as Record<string, unknown>).forEach((value) => {
      collectLocaleCandidates(value, out);
    });
    return;
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    collectLocaleCandidates(String(input), out);
  }
}

/**
 * Parses unknown locale input into ordered locale candidates.
 * Supports BCP47 strings, accept-language style strings, arrays,
 * Intl.Locale instances, and locale-like objects.
 */
export function resolveLocaleInput(input: unknown): string[] {
  const candidates: string[] = [];
  collectLocaleCandidates(input, candidates);
  return candidates;
}

/**
 * Chooses a locale from `available` using the parsed candidates from `input`.
 * Falls back to `en` when available, then the first provided locale.
 */
export function pickMessageLocale(input: unknown, available: string[]): string {
  if (available.length === 0) {
    return 'en';
  }

  const normalizedAvailable = new Map<string, string>();
  available.forEach((locale) => {
    const canonical = canonicalizeLocale(locale) ?? locale;
    normalizedAvailable.set(canonical.toLowerCase(), locale);
  });

  const candidates = resolveLocaleInput(input);

  for (const candidate of candidates) {
    const exact = normalizedAvailable.get(candidate.toLowerCase());
    if (exact) {
      return exact;
    }

    const language = candidate.split('-')[0]?.toLowerCase();
    if (!language) {
      continue;
    }

    let languageMatch: string | null = null;
    normalizedAvailable.forEach((original, normalized) => {
      if (!languageMatch && (normalized === language || normalized.startsWith(`${language}-`))) {
        languageMatch = original;
      }
    });
    if (languageMatch) {
      return languageMatch;
    }
  }

  const english = available.find((locale) => locale.toLowerCase() === 'en');
  if (english) {
    return english;
  }

  return available[0];
}
