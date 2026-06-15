import { Drawer, Form, Select, Slider, Space, Button, Divider, App as AntApp } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { Language, ThemeMode, CHATS_LIMIT } from '../utils/constants';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenPromptLibrary: () => void;
  onOpenCustomConfig: () => void;
  onOpenShortcut: () => void;
}

export default function SettingsDrawer({
  open, onClose, onOpenPromptLibrary, onOpenCustomConfig, onOpenShortcut,
}: Props) {
  const { t } = useTranslation();
  const options = useAppStore(s => s.options);
  const updateOptions = useAppStore(s => s.updateOptions);
  const { message } = AntApp.useApp();

  return (
    <Drawer open={open} onClose={onClose} title={t('menu.settings')} width={360}>
      <Form layout="vertical" style={{ paddingBottom: 'var(--v-space-lg)' }}>
        <Form.Item
          label={t('menu.themeMode')}
          style={{ marginBottom: 'var(--v-space-lg)' }}
        >
          <Select
            value={options.themeMode}
            onChange={v => updateOptions({ themeMode: v })}
            options={[
              { value: ThemeMode.System, label: t('theme.system') },
              { value: ThemeMode.Light, label: t('theme.light') },
              { value: ThemeMode.Dark, label: t('theme.dark') },
            ]}
          />
        </Form.Item>

        <Form.Item
          label={t('menu.language')}
          style={{ marginBottom: 'var(--v-space-lg)' }}
        >
          <Select
            value={options.language}
            onChange={v => updateOptions({ language: v })}
            options={[
              { value: Language.System, label: t('language.system') },
              { value: Language.English, label: t('language.en') },
              { value: Language.ChineseSimplified, label: t('language.zh-CN') },
            ]}
          />
        </Form.Item>

        <Form.Item
          label={`${t('menu.columnMaxCount')} (0 = ${t('menu.columnMaxCountAuto')})`}
          style={{ marginBottom: 'var(--v-space-xl)' }}
        >
          <Slider
            min={0}
            max={CHATS_LIMIT}
            value={options.colMaxCount}
            onChange={v => updateOptions({ colMaxCount: v })}
          />
        </Form.Item>

        <Divider style={{ margin: 'var(--v-space-md) 0 var(--v-space-lg)' }} />

        <Space direction="vertical" style={{ width: '100%', gap: 'var(--v-space-sm)' }}>
          <Button block type="default" onClick={onOpenPromptLibrary}>{t('menu.promptLibrary')}</Button>
          <Button block type="default" onClick={onOpenCustomConfig}>{t('menu.customConfig')}</Button>
          <Button block type="default" onClick={onOpenShortcut}>{t('menu.shortcut')}</Button>
        </Space>

        <Divider style={{ margin: 'var(--v-space-lg) 0 var(--v-space-md)' }} />

        <Space direction="vertical" style={{ width: '100%', gap: 'var(--v-space-sm)' }}>
          <Button block type="default" onClick={() => window.open('https://github.com/yourname/chathub-replica', '_blank')}>
            {t('menu.homepage')}
          </Button>
          <Button block type="default" onClick={() => message.info('thank you!')}>
            {t('menu.rateUs')}
          </Button>
        </Space>
      </Form>
    </Drawer>
  );
}
