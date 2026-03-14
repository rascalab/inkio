import { pickMessageLocale, resolveLocaleInput } from '../locale';

describe('locale parser', () => {
  it('parses plain locale strings and expands language fallback', () => {
    expect(resolveLocaleInput('en-US')).toEqual(['en-US', 'en']);
    expect(resolveLocaleInput('ko_KR')).toEqual(['ko-KR', 'ko']);
  });

  it('parses accept-language style strings with quality values', () => {
    expect(resolveLocaleInput('ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.6')).toEqual([
      'ko-KR',
      'ko',
      'en-US',
      'en',
    ]);
  });

  it('parses array and locale-like object inputs', () => {
    const localeLike = {
      locale: 'fr-CA',
      fallback: 'en',
      toString: () => 'ignored',
    };

    expect(resolveLocaleInput(['de-DE', localeLike, 'en'])).toEqual([
      'de-DE',
      'de',
      'fr-CA',
      'fr',
      'en',
    ]);
  });

  it('accepts Intl.Locale instances', () => {
    expect(resolveLocaleInput(new Intl.Locale('pt-BR'))).toEqual(['pt-BR', 'pt']);
  });
});

describe('pickMessageLocale', () => {
  it('selects the best matching locale by exact match', () => {
    expect(pickMessageLocale('en-US,en;q=0.8', ['ko', 'en'])).toBe('en');
  });

  it('falls back to english when no candidate matches', () => {
    expect(pickMessageLocale('ja', ['en', 'fr'])).toBe('en');
  });

  it('falls back to first available locale when english is unavailable', () => {
    expect(pickMessageLocale('ja', ['fr', 'de'])).toBe('fr');
  });
});
