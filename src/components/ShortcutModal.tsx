import { useState } from 'react';
import { Modal, Form, Radio, List, Button, Tag, Space, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import {
  ALL_SHORTCUT_ACTIONS, DEFAULT_SHORTCUT_BINDINGS, INTENT_SCOPED_ACTIONS,
  PATTERN_ACTIONS, FIXED_KEY_ACTIONS, formatShortcut, applyShortcutConfig,
} from '../utils/shortcuts';
import type { ShortcutAction, ShortcutBinding, ShortcutConfig } from '../types';

interface Props { open: boolean; onClose: () => void; }

interface RecordState {
  action: ShortcutAction | null;
}

export default function ShortcutModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const cfg = useAppStore(s => s.shortcutConfig);
  const setCfg = useAppStore(s => s.setShortcutConfig);
  const [recording, setRecording] = useState<RecordState>({ action: null });

  function getBinding(action: ShortcutAction): ShortcutBinding {
    return cfg.shortcuts[action] ?? DEFAULT_SHORTCUT_BINDINGS[action];
  }

  function startRecord(action: ShortcutAction) {
    setRecording({ action });
    const handler = (ev: KeyboardEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      // Ignore modifier-only keys
      if (['Meta', 'Control', 'Alt', 'Shift'].includes(ev.key)) return;
      const next: ShortcutBinding = {
        cmdOrCtrl: ev.metaKey || ev.ctrlKey,
        alt: ev.altKey,
        shift: ev.shiftKey,
        code: PATTERN_ACTIONS.includes(action) ? undefined : ev.code,
        codePattern: PATTERN_ACTIONS.includes(action) ? /^Digit(\d)$/ : undefined,
      };
      const updated: ShortcutConfig = {
        ...cfg,
        shortcuts: { ...cfg.shortcuts, [action]: next },
      };
      setCfg(updated);
      applyShortcutConfig(updated);
      window.removeEventListener('keydown', handler, true);
      setRecording({ action: null });
    };
    window.addEventListener('keydown', handler, true);
  }

  function reset(action: ShortcutAction) {
    const updated: ShortcutConfig = {
      ...cfg,
      shortcuts: { ...cfg.shortcuts, [action]: undefined as any },
    };
    delete updated.shortcuts[action];
    setCfg(updated);
    applyShortcutConfig(updated);
  }

  function toggleDisabled(action: ShortcutAction) {
    const b = getBinding(action);
    const updated: ShortcutConfig = {
      ...cfg,
      shortcuts: { ...cfg.shortcuts, [action]: { ...b, disabled: !b.disabled } },
    };
    setCfg(updated);
    applyShortcutConfig(updated);
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('shortcut.title')} width={680}>
      <Form layout="vertical">
        <Form.Item label={t('shortcut.sendMessage')}>
          <Radio.Group
            value={cfg.sendKeyMode}
            onChange={e => setCfg({ ...cfg, sendKeyMode: e.target.value })}
          >
            <Radio value="enter">{t('shortcut.sendMessageEnter')}</Radio>
            <Radio value="cmdOrCtrlEnter">{t('shortcut.sendMessageCmdEnter')}</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>

      <Alert
        type="info"
        showIcon
        message={t('shortcut.info')}
        style={{
          marginBottom: 12,
          background: 'var(--v-surface-2)',
          border: '1px solid var(--v-hairline)',
          color: 'var(--v-body)',
        }}
      />

      <List
        dataSource={ALL_SHORTCUT_ACTIONS}
        renderItem={action => {
          const b = getBinding(action);
          const isRec = recording.action === action;
          const label = isRec ? t('shortcut.recording') : formatShortcut(action, 1) + (PATTERN_ACTIONS.includes(action) ? '–N' : '');
          return (
            <List.Item
              actions={[
                <Button size="small" type={b.disabled ? 'default' : 'primary'} onClick={() => toggleDisabled(action)}>
                  {b.disabled ? 'Enable' : 'Disable'}
                </Button>,
                <Button size="small" onClick={() => startRecord(action)}>{t('shortcut.record')}</Button>,
                <Button size="small" onClick={() => reset(action)}>{t('common.reset')}</Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {t(`shortcut.${action}`)}
                    {INTENT_SCOPED_ACTIONS.includes(action) ? <Tag className="tag-accent">{t('shortcut.chatPanelShortcut')}</Tag> : <Tag className="tag-accent-secondary">{t('shortcut.globalShortcut')}</Tag>}
                  </Space>
                }
                description={<Tag>{label}</Tag>}
              />
            </List.Item>
          );
        }}
      />
    </Modal>
  );
}
