// Language choice for the chat. Browser and localStorage only, no network.
// Order: stored choice, browser setting, default.

import { SupportedLanguage } from './types';

export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

const STORAGE_KEY = 'triage-chat-language';

export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
}

// Any regional tag such as es-MX or en-GB maps to its base language.
export function detectBrowserLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  const tags = [navigator.language, ...(navigator.languages || [])];
  for (const tag of tags) {
    if (!tag) continue;
    const base = tag.toLowerCase().split('-')[0];
    if (isSupportedLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

export function getStoredLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isSupportedLanguage(stored)) return stored;
  } catch {
    // Storage can be blocked. Fall through to null.
  }
  return null;
}

export function storeLanguage(language: SupportedLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be blocked. The choice lasts for this page only.
  }
}

export function determineLanguage(): SupportedLanguage {
  return getStoredLanguage() ?? detectBrowserLanguage();
}

const LANGUAGE_INFO = {
  en: { code: 'en', name: 'English', nativeName: 'English', rtl: false },
  es: { code: 'es', name: 'Spanish', nativeName: 'Español', rtl: false },
} as const;

export function getLanguageInfo(language: SupportedLanguage) {
  return LANGUAGE_INFO[language];
}

export function getAllLanguageInfo() {
  return SUPPORTED_LANGUAGES.map(getLanguageInfo);
}

// Sample context per language. Static data, not a clinical source.
export function getRegionalContext(language: SupportedLanguage): {
  emergencyNumber: string;
  commonInsuranceTypes: string[];
  culturalConsiderations: string[];
} {
  if (language === 'es') {
    return {
      emergencyNumber: '911',
      commonInsuranceTypes: [
        'Medicaid',
        'Medicare',
        'Covered California',
        'Medi-Cal',
        'Community Health Plans',
        'Emergency Medicaid',
      ],
      culturalConsiderations: [
        'Family involvement in healthcare decisions',
        'Preference for same-language providers',
        'Community health center familiarity',
        'Cash payment traditions',
        'Herbal and traditional remedy integration',
      ],
    };
  }
  return {
    emergencyNumber: '911',
    commonInsuranceTypes: [
      'Private Insurance',
      'Medicare',
      'Medicaid',
      'ACA Marketplace Plans',
      'Employer-based Insurance',
    ],
    culturalConsiderations: [
      'Individual healthcare decision-making',
      'Insurance navigation familiarity',
      'Online healthcare resource usage',
    ],
  };
}
