import { useState } from 'react';
import { Modal, Input, Button, List, Form, Space, Tag, App as AntApp } from 'antd';
import { PlusOutlined, DeleteOutlined, MinusOutlined } from '@ant-design/icons';
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
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Input
            placeholder="Layout name"
            value={name}
            onChange={e => setName(e.target.value)}
            onPressEnter={newLayout}
          />
          <Button icon={<PlusOutlined />} type="primary" onClick={newLayout}>
            {t('app.layoutAdd')}
          </Button>
        </Space>

        <List
          dataSource={options.layoutPresets}
          renderItem={preset => (
            <List.Item
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
                title={preset.name || preset.id}
                description={
                  <Space wrap>
                    {allAppIds.map(id => {
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
                }
              />
            </List.Item>
          )}
        />
      </Space>
    </Modal>
  );
}
