import { useState } from 'react';
import { Modal, Form, Input, Select, Button, List, Space, App as AntApp, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { PROTOCOL_SOURCE } from '../utils/constants';
import type { ChatAppConfig } from '../types';

interface Props { open: boolean; onClose: () => void; }

export default function CustomConfigModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const items = useAppStore(s => s.customConfigs);
  const setItems = useAppStore(s => s.setCustomConfigs);
  const { modal } = AntApp.useApp();
  const [editing, setEditing] = useState<ChatAppConfig | null>(null);
  const [advanced, setAdvanced] = useState('');
  const [form] = Form.useForm();

  function startNew() {
    setEditing({ id: '', url: '', inputMethod: 'execCommand' } as ChatAppConfig);
    form.resetFields();
    setAdvanced('');
  }
  function startEdit(c: ChatAppConfig) {
    setEditing(c);
    form.setFieldsValue(c);
    const { id, url, inputMethod, firefoxInputMethod, ...adv } = c;
    setAdvanced(Object.keys(adv).length ? JSON.stringify(adv, null, 2) : '');
  }
  async function save() {
    const values = await form.validateFields();
    if (!editing) return;
    let extra = {};
    if (advanced.trim()) {
      try { extra = JSON.parse(advanced); }
      catch { return modal.warning({ title: 'Invalid JSON', content: 'Advanced config must be valid JSON' }); }
    }
    const next: ChatAppConfig = { ...values, ...extra } as ChatAppConfig;
    const list = items.some(x => x.id === editing.id)
      ? items.map(x => x.id === editing.id ? next : x)
      : [...items, next];
    await setItems(list);
    setEditing(null);
    chrome.runtime.sendMessage({ source: PROTOCOL_SOURCE, action: 'reloadConfigs' });
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('customConfig.title')} width={760}>
      {!editing ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button icon={<PlusOutlined />} type="primary" onClick={startNew}>
            {t('customConfig.add')}
          </Button>
          <List
            dataSource={items}
            locale={{ emptyText: t('customConfig.empty') }}
            renderItem={item => (
              <List.Item
                actions={[
                  <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(item)} />,
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => modal.confirm({
                      title: t('common.confirm'),
                      onOk: () => setItems(items.filter(x => x.id !== item.id)),
                    })}
                  />,
                ]}
              >
                <List.Item.Meta title={item.id} description={item.url} />
              </List.Item>
            )}
          />
        </Space>
      ) : (
        <Form layout="vertical" form={form} initialValues={editing}>
          <Form.Item name="id" label={t('customConfig.id')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="url" label={t('customConfig.url')} rules={[{ required: true, type: 'url' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="inputSelector" label={t('customConfig.inputSelector')}>
            <Input placeholder="textarea, [contenteditable]" />
          </Form.Item>
          <Form.Item name="sendButtonSelector" label={t('customConfig.sendButtonSelector')}>
            <Input placeholder="button[type=submit]" />
          </Form.Item>
          <Form.Item name="inputMethod" label={t('customConfig.inputMethod')}>
            <Select
              options={[
                { value: 'execCommand', label: 'execCommand (default)' },
                { value: 'text', label: 'text (innerText)' },
                { value: 'input', label: 'input (value)' },
                { value: 'paste', label: 'paste (clipboard event)' },
                { value: 'pasteAndText', label: 'pasteAndText (combo)' },
              ]}
            />
          </Form.Item>
          <Form.Item label={t('customConfig.advancedConfig')}>
            <Alert
              type="info"
              showIcon
              message="JSON: inputActions, sendActions, readyActions, newChatActions, networkRules"
              style={{
                background: 'var(--v-surface-2)',
                border: '1px solid var(--v-hairline)',
                color: 'var(--v-body)',
              }}
            />
            <Input.TextArea
              rows={8}
              value={advanced}
              onChange={e => setAdvanced(e.target.value)}
              style={{ marginTop: 8, fontFamily: 'var(--v-font-mono)' }}
            />
          </Form.Item>
          <Space>
            <Button onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button type="primary" onClick={save}>{t('common.save')}</Button>
          </Space>
        </Form>
      )}
    </Modal>
  );
}
