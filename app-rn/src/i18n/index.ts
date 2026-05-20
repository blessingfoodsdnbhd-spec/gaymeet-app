import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en.json';
import zh from './zh.json';

const STORAGE_KEY = 'meyou.lang';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  // Bilingual UI in the wild — default to Chinese to match the design copy,
  // user can switch in Settings → 语言 and we'll persist the choice below.
  lng: 'zh',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  // RN doesn't ship a full Intl.PluralRules; this opts into the legacy
  // JSON format and silences the bootstrap warning.
  compatibilityJSON: 'v3',
});

// Restore the user's previous language selection on app boot. Async — fires
// after the initial render but before most navigation happens; the brief
// flicker from default zh → restored en is acceptable for the cold-start
// path, and there's no flicker for users keeping the default.
AsyncStorage.getItem(STORAGE_KEY)
  .then((saved) => {
    if (saved && saved !== i18n.language) {
      i18n.changeLanguage(saved);
    }
  })
  .catch(() => {
    // best-effort
  });

// Persist any language change so the next launch picks it up.
i18n.on('languageChanged', (lng) => {
  AsyncStorage.setItem(STORAGE_KEY, lng).catch(() => {});
});

export default i18n;
