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
        algorithm: antdTheme.darkAlgorithm,
        token: {
          colorPrimary: '#ffffff',
          colorBgBase: '#010120',
          colorBgContainer: '#010120',
          colorBgElevated: '#26263a',
          colorBorder: '#26263a',
          colorText: '#ffffff',
          colorTextSecondary: '#999999',
          colorTextTertiary: '#a09d96',
          borderRadius: 4,
          fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 13,
          controlHeight: 32,
        },
        components: {
          Button: {
            colorPrimaryHover: '#f0f0f5',
            colorPrimaryActive: '#bdbbff',
            defaultBg: 'transparent',
            defaultColor: '#999999',
          },
          Input: {
            colorBgContainer: '#0a0a2a',
            colorBorder: '#26263a',
            activeBorderColor: '#ffffff',
            hoverBorderColor: '#313641',
          },
          Select: {
            colorBgContainer: '#0a0a2a',
            colorBorder: '#26263a',
            optionSelectedBg: 'rgba(189, 189, 255, 0.08)',
            optionActiveBg: 'rgba(189, 189, 255, 0.06)',
          },
          Modal: {
            colorBgElevated: '#010120',
            headerBg: '#010120',
            titleColor: '#ffffff',
          },
          Drawer: {
            colorBgElevated: '#010120',
          },
          Tabs: {
            inkBarColor: '#ffffff',
            itemSelectedColor: '#ffffff',
            itemHoverColor: '#ffffff',
            itemColor: '#999999',
          },
          Tag: {
            defaultBg: '#26263a',
            defaultColor: '#999999',
          },
          Dropdown: {
            colorBgElevated: '#26263a',
          },
          List: {
            colorSplit: '#26263a',
          },
        },
      }}
    >
      <AntApp>
        {ready ? <ChatHubPage /> : null}
      </AntApp>
    </ConfigProvider>
  );
}
