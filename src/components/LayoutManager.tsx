import { useState } from 'react';
import { Modal, Input, Button, List, Form, Space, Tag, App as AntApp } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { v4 as uuid } from 'uuid';
import { PLATFORM_DISPLAY } from '../platforms/configs';
import type { LayoutPreset } from '../types';

interface Props { open: boolean; onClose: () => void; }

export default function LayoutManager({ open, onClose }: Props) {
  const { t } = useTranslation();
  const options = useAppStore(s => s.options);
  const bundle = useAppStore(s => s.bundle);
  const addLayout = useAppStore(s => s.addLayout);
  const updateLayout = useAppStore(s => s.updateLayout);
  const removeLayout = useAppStore(s => s.removeLayout);
  const { modal } = AntApp.useApp();
  const [name, setName] = useState('');

  const allAppIds = bundle?.chatApps.map(a => a.id) || [];

  // Group platforms by bundle.chatGroups (international / chinese / custom),
  // collecting any ungrouped apps under an "other" bucket so nothing disappears.
  const groupedAppIds = (() => {
    const groups = bundle?.chatGroups || [];
    const seen = new Set<string>();
    const result = groups.map(g => {
      const ids = g.chatAppIds.filter(id => {
        if (seen.has(id) || !allAppIds.includes(id)) return false;
        seen.add(id);
        return true;
      });
      return { id: g.id, ids };
    }).filter(g => g.ids.length > 0);
    const leftover = allAppIds.filter(id => !seen.has(id));
    if (leftover.length) result.push({ id: 'other', ids: leftover });
    return result;
  })();

  function groupLabel(id: string) {
    const key = `group.${id}`;
    const translated = t(key);
    return translated === key ? id : translated;
  }

  function newLayout() {
    if (!name.trim()) return;
    const preset: LayoutPreset = { id: uuid(), name: name.trim(), appIdGroups: [] };
    addLayout(preset);
    setName('');
  }

  function togglePanel(preset: LayoutPreset, id: string) {
    const all = preset.appIdGroups.flat();
    const next = all.includes(id) ? all.filter(x => x !== id) : [...all, id];
    updateLayout(preset.id, { appIdGroups: next.map(x => [x]) });
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('app.selectLayout')} width={760}>
      <Space direction="vertical" style={{ width: '100%', gap: 'var(--v-space-lg)' }}>
        <Space style={{ width: '100%' }}>
          <Input
            placeholder="Layout name"
            value={name}
            onChange={e => setName(e.target.value)}
            onPressEnter={newLayout}
            style={{ width: 280 }}
          />
          <Button icon={<PlusOutlined />} type="primary" onClick={newLayout}>
            {t('app.layoutAdd')}
          </Button>
        </Space>

        <List
          bordered
          dataSource={options.layoutPresets}
          style={{ borderColor: 'var(--v-hairline)', borderRadius: 'var(--v-radius-sm)', overflow: 'hidden' }}
          renderItem={preset => (
            <List.Item
              style={{ borderColor: 'var(--v-hairline)', padding: 'var(--v-space-md) var(--v-space-lg)' }}
              actions={[
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => modal.confirm({
                    title: t('common.confirm'),
                    content: t('app.layoutRemove') + ': ' + (preset.name || preset.id),
                    onOk: () => removeLayout(preset.id),
                  })}
                >{t('common.delete')}</Button>,
              ]}
            >
              <List.Item.Meta
                title={<span style={{ color: 'var(--v-ink)', fontWeight: 600 }}>{preset.name || preset.id}</span>}
                description={
                  <Space direction="vertical" style={{ width: '100%', marginTop: 'var(--v-space-xs)', gap: 'var(--v-space-sm)' }}>
                    {groupedAppIds.map(group => (
                      <div key={group.id}>
                        <div style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--v-mute)',
                          marginBottom: 'var(--v-space-xs)',
                        }}>
                          {groupLabel(group.id)}
                        </div>
                        <Space wrap>
                          {group.ids.map(id => {
                            const selected = preset.appIdGroups.flat().includes(id);
                            const label = PLATFORM_DISPLAY[id]?.name || id;
                            return (
                              <Tag.CheckableTag
                                key={id}
                                checked={selected}
                                onChange={() => togglePanel(preset, id)}
                              >
                                {label}
                              </Tag.CheckableTag>
                            );
                          })}
                        </Space>
                      </div>
                    ))}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Space>
    </Modal>
  );
}
