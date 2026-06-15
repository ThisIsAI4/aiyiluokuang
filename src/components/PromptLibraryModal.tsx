import { useState } from 'react';
import { Modal, List, Input, Form, Button, Space, App as AntApp } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store';
import { v4 as uuid } from 'uuid';
import type { PromptItem } from '../types';

interface Props { open: boolean; onClose: () => void; }

export default function PromptLibraryModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const items = useAppStore(s => s.promptLibrary);
  const setItems = useAppStore(s => s.setPromptLibrary);
  const { modal } = AntApp.useApp();
  const [editing, setEditing] = useState<PromptItem | null>(null);
  const [form] = Form.useForm();

  function startNew() {
    setEditing({ id: uuid(), title: '', content: '' });
    form.resetFields();
  }
  function startEdit(p: PromptItem) {
    setEditing(p);
    form.setFieldsValue(p);
  }
  async function save() {
    const values = await form.validateFields();
    if (!editing) return;
    const next = items.some(p => p.id === editing.id)
      ? items.map(p => p.id === editing.id ? { ...p, ...values } : p)
      : [...items, { ...editing, ...values }];
    await setItems(next);
    setEditing(null);
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('promptLibrary.title')} width={720}>
      {!editing ? (
        <Space direction="vertical" style={{ width: '100%', gap: 'var(--v-space-lg)' }}>
          <Button icon={<PlusOutlined />} type="primary" onClick={startNew}>
            {t('promptLibrary.add')}
          </Button>
          <List
            dataSource={items}
            locale={{ emptyText: t('promptLibrary.empty') }}
            renderItem={p => (
              <List.Item
                actions={[
                  <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(p)} />,
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => modal.confirm({
                      title: t('promptLibrary.confirmDelete'),
                      onOk: () => setItems(items.filter(x => x.id !== p.id)),
                    })}
                  />,
                ]}
              >
                <List.Item.Meta title={p.title} description={p.content.slice(0, 120)} />
              </List.Item>
            )}
          />
        </Space>
      ) : (
        <Form layout="vertical" form={form} initialValues={editing}>
          <Form.Item name="title" label={t('promptLibrary.promptTitle')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label={t('promptLibrary.promptContent')} rules={[{ required: true }]}>
            <Input.TextArea rows={6} />
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
