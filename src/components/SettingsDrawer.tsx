import { Drawer, Form, Select, Slider, Space, Button, Divider, ColorPicker, App as AntApp } from 'antd';
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
      <Form layout="vertical">
        <Form.Item label={t('menu.themeMode')}>
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

        <Form.Item label={t('menu.language')}>
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

        <Form.Item label={t('menu.primaryColor')}>
          <ColorPicker
            value={options.primaryColor}
            onChange={c => updateOptions({ primaryColor: c.toHexString() })}
          />
        </Form.Item>

        <Form.Item label={`${t('menu.columnMaxCount')} (0 = ${t('menu.columnMaxCountAuto')})`}>
          <Slider
            min={0}
            max={CHATS_LIMIT}
            value={options.colMaxCount}
            onChange={v => updateOptions({ colMaxCount: v })}
          />
        </Form.Item>

        <Divider />

        <Space direction="vertical" style={{ width: '100%' }}>
          <Button block onClick={onOpenPromptLibrary}>{t('menu.promptLibrary')}</Button>
          <Button block onClick={onOpenCustomConfig}>{t('menu.customConfig')}</Button>
          <Button block onClick={onOpenShortcut}>{t('menu.shortcut')}</Button>
        </Space>

        <Divider />

        <Space direction="vertical" style={{ width: '100%' }}>
          <Button block onClick={() => window.open('https://github.com/yourname/chathub-replica', '_blank')}>
            {t('menu.homepage')}
          </Button>
          <Button block onClick={() => message.info('thank you!')}>
            {t('menu.rateUs')}
          </Button>
        </Space>
      </Form>
    </Drawer>
  );
}
