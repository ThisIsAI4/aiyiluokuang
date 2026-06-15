import { useEffect } from 'react';
import { ConfigProvider, theme as antdTheme, App as AntApp } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppStore } from './store';
import ChatHubPage from './pages/ChatHub';
import { Language } from './utils/constants';
import { detectInitialLanguage } from './locales';

export default function App() {
  const ready = useAppStore(s => s.ready);
  const options = useAppStore(s => s.options);
  const init = useAppStore(s => s.init);
  const { i18n } = useTranslation();

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (!ready) return;
    const wanted = options.language === Language.System
      ? detectInitialLanguage(options.language)
      : options.language;
    if (i18n.language !== wanted) i18n.changeLanguage(wanted);
  }, [ready, options.language, i18n]);

  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#615ced',
          colorBgBase: '#ffffff',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#f7f7fb',
          colorBorder: '#e8e8ef',
          colorText: '#1a1a2e',
          colorTextSecondary: '#6b6b7b',
          colorTextTertiary: '#9a9aaa',
          borderRadius: 8,
          fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 13,
          controlHeight: 32,
        },
        components: {
          Button: {
            colorPrimaryHover: '#7a76f2',
            colorPrimaryActive: '#4a46c0',
            defaultBg: 'transparent',
            defaultColor: '#6b6b7b',
            defaultBorderColor: '#e8e8ef',
          },
          Input: {
            colorBgContainer: '#f7f7fb',
            colorBorder: '#e8e8ef',
            activeBorderColor: '#615ced',
            hoverBorderColor: '#d0d0de',
          },
          Select: {
            colorBgContainer: '#f7f7fb',
            colorBorder: '#e8e8ef',
            optionSelectedBg: 'rgba(97, 92, 237, 0.08)',
            optionActiveBg: 'rgba(97, 92, 237, 0.06)',
          },
          Modal: {
            colorBgElevated: '#ffffff',
            headerBg: '#ffffff',
            titleColor: '#1a1a2e',
          },
          Drawer: {
            colorBgElevated: '#ffffff',
          },
          Tabs: {
            inkBarColor: '#615ced',
            itemSelectedColor: '#615ced',
            itemHoverColor: '#615ced',
            itemColor: '#6b6b7b',
          },
          Tag: {
            defaultBg: '#f0f0f5',
            defaultColor: '#6b6b7b',
          },
          Dropdown: {
            colorBgElevated: '#ffffff',
          },
          List: {
            colorSplit: '#e8e8ef',
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
