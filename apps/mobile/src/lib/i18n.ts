import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import fr from '@/locales/fr.json';

/**
 * Les 10 langues les plus parlées au monde. `translated: false` = l'interface
 * retombe sur l'anglais tant que la traduction n'est pas livrée (phase 7).
 * `rtl` = écriture de droite à gauche (arabe, ourdou).
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', nativeName: 'English', rtl: false, translated: true },
  { code: 'fr', nativeName: 'Français', rtl: false, translated: true },
  { code: 'es', nativeName: 'Español', rtl: false, translated: false },
  { code: 'pt', nativeName: 'Português', rtl: false, translated: false },
  { code: 'zh', nativeName: '中文', rtl: false, translated: false },
  { code: 'hi', nativeName: 'हिन्दी', rtl: false, translated: false },
  { code: 'ar', nativeName: 'العربية', rtl: true, translated: false },
  { code: 'bn', nativeName: 'বাংলা', rtl: false, translated: false },
  { code: 'ru', nativeName: 'Русский', rtl: false, translated: false },
  { code: 'ur', nativeName: 'اردو', rtl: true, translated: false },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const STORAGE_KEY = 'bps.language';

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === code);
}

/** Première langue du téléphone supportée par l'app, sinon anglais. */
export function detectDeviceLanguage(): LanguageCode {
  for (const locale of getLocales()) {
    if (isSupportedLanguage(locale.languageCode)) return locale.languageCode;
  }
  return 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: detectDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Applique la langue choisie manuellement (si l'utilisateur l'a changée)
void AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
  if (isSupportedLanguage(saved) && saved !== i18n.language) void i18n.changeLanguage(saved);
});

export async function setAppLanguage(code: LanguageCode) {
  await AsyncStorage.setItem(STORAGE_KEY, code);
  await i18n.changeLanguage(code);
}

export function currentLanguage(): LanguageCode {
  return isSupportedLanguage(i18n.language) ? i18n.language : 'en';
}

/** Fuseau horaire IANA du téléphone (ex. "Europe/Paris"). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Pays du téléphone (ISO 3166-1 alpha-2) si connu. */
export function deviceCountry(): string | null {
  return getLocales()[0]?.regionCode ?? null;
}

export default i18n;
