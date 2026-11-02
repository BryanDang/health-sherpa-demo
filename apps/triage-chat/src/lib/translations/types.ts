// Language types. Only en and es are handled so far.

export type SupportedLanguage = 'en' | 'es';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  rtl?: boolean;
}
