// Language detector. Pure browser logic, runs in jsdom.

import {
  DEFAULT_LANGUAGE,
  detectBrowserLanguage,
  determineLanguage,
  getAllLanguageInfo,
  getRegionalContext,
  getStoredLanguage,
  isSupportedLanguage,
  storeLanguage,
} from '@/lib/translations/detector';

function setBrowserLanguages(primary: string, all: string[] = [primary]) {
  Object.defineProperty(window.navigator, 'language', {
    value: primary,
    configurable: true,
  });
  Object.defineProperty(window.navigator, 'languages', {
    value: all,
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  setBrowserLanguages('en-US');
});

describe('isSupportedLanguage', () => {
  test('accepts en and es', () => {
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('es')).toBe(true);
  });

  test('rejects anything else', () => {
    expect(isSupportedLanguage('fr')).toBe(false);
    expect(isSupportedLanguage('')).toBe(false);
  });
});

describe('detectBrowserLanguage', () => {
  test('maps regional Spanish tags to es', () => {
    setBrowserLanguages('es-MX');
    expect(detectBrowserLanguage()).toBe('es');
    setBrowserLanguages('es-419');
    expect(detectBrowserLanguage()).toBe('es');
  });

  test('maps regional English tags to en', () => {
    setBrowserLanguages('en-GB');
    expect(detectBrowserLanguage()).toBe('en');
  });

  test('skips unsupported tags and takes the next supported one', () => {
    setBrowserLanguages('fr-FR', ['fr-FR', 'es-ES']);
    expect(detectBrowserLanguage()).toBe('es');
  });

  test('falls back to the default', () => {
    setBrowserLanguages('de-DE');
    expect(detectBrowserLanguage()).toBe(DEFAULT_LANGUAGE);
  });
});

describe('stored choice', () => {
  test('round trips through localStorage', () => {
    expect(getStoredLanguage()).toBeNull();
    storeLanguage('es');
    expect(getStoredLanguage()).toBe('es');
  });

  test('ignores an unsupported stored value', () => {
    localStorage.setItem('triage-chat-language', 'xx');
    expect(getStoredLanguage()).toBeNull();
  });

  test('stored choice wins over the browser setting', () => {
    setBrowserLanguages('es-ES');
    storeLanguage('en');
    expect(determineLanguage()).toBe('en');
  });

  test('browser setting is used when nothing is stored', () => {
    setBrowserLanguages('es-ES');
    expect(determineLanguage()).toBe('es');
  });
});

describe('language data', () => {
  test('lists both languages', () => {
    expect(getAllLanguageInfo().map((l) => l.code)).toEqual(['en', 'es']);
  });

  test('regional context differs by language', () => {
    expect(getRegionalContext('es').commonInsuranceTypes).toContain('Medi-Cal');
    expect(getRegionalContext('en').commonInsuranceTypes).not.toContain(
      'Medi-Cal'
    );
    expect(getRegionalContext('es').emergencyNumber).toBe('911');
  });
});
