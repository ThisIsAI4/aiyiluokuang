import { useEffect, useState } from 'react';
import { ConfigProvider, theme as antdTheme, App as AntApp } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './store';
import ChatHubPage from './pages/ChatHub';
import { ThemeMode, Language } from './utils/constants';
import { detectInitialLanguage } from './locales';

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (ev: MediaQueryListEvent) => setDark(ev.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return dark;
}

export default function App() {
  const ready = useAppStore(s => s.ready);
  const options = useAppStore(s => s.options);
  const init = useAppStore(s => s.init);
  const { i18n } = useTranslation();
  const systemDark = useSystemDark();

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (!ready) return;
    const wanted = options.language === Language.System
      ? detectInitialLanguage(options.language)
      : options.language;
    if (i18n.language !== wanted) i18n.changeLanguage(wanted);
  }, [ready, options.language, i18n]);

  const isDark = options.themeMode === ThemeMode.System
    ? systemDark
    : options.themeMode === ThemeMode.Dark;

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: options.primaryColor },
      }}
    >
      <AntApp>
        {ready ? <ChatHubPage /> : null}
      </AntApp>
    </ConfigProvider>
  );
}
