import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import zh from './zh.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  // Bilingual UI in the wild — default to Chinese to match the design copy,
  // user can switch in Settings → 语言.
  lng: 'zh',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  // RN doesn't ship a full Intl.PluralRules; this opts into the legacy
  // JSON format and silences the bootstrap warning.
  compatibilityJSON: 'v3',
});

export default i18n;
