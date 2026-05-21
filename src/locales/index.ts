import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Language } from '../utils/constants';
import en from './en';
import zhCN from './zh-CN';

export const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
} as const;

export function detectInitialLanguage(stored?: Language): string {
  if (stored && stored !== Language.System) return stored;
  const ui = chrome.i18n?.getUILanguage?.() || navigator.language;
  if (Object.values(Language).includes(ui as Language)) return ui;
  const short = ui.slice(0, 2);
  if (Object.values(Language).includes(short as Language)) return short;
  return Language.English;
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
