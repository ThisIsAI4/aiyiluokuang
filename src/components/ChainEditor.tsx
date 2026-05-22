import React, { useEffect, useMemo, useState } from 'react';
import { Drawer, Button, Select, Input, List, Space, message } from 'antd';
import { DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useAppStore } from '../store';
import { DEFAULT_CHAIN_TEMPLATE } from '../utils/chainTemplate';
import { STORAGE_KEYS } from '../utils/constants';
import { PLATFORM_DISPLAY } from '../platforms/configs';

export type ChainPreset = {
  id: string;
  name: string;
  platformIds: string[];
  template: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialPlatformIds: string[];
  initialTemplate: string;
  onConfirm: (platformIds: string[], template: string) => void;
};

export function ChainEditor({ open, onClose, initialPlatformIds, initialTemplate, onConfirm }: Props) {
  const bundle = useAppStore(s => s.bundle);
  const [platformIds, setPlatformIds] = useState<string[]>(initialPlatformIds);
  const [template, setTemplate] = useState<string>(initialTemplate || DEFAULT_CHAIN_TEMPLATE);
  const [presets, setPresets] = useState<ChainPreset[]>([]);
  const [presetName, setPresetName] = useState('');

  useEffect(() => { setPlatformIds(initialPlatformIds); }, [initialPlatformIds, open]);
  useEffect(() => { setTemplate(initialTemplate || DEFAULT_CHAIN_TEMPLATE); }, [initialTemplate, open]);

  useEffect(() => {
    if (!open) return;
    chrome.storage.local.get(STORAGE_KEYS.chainPresets).then(obj => {
      const list = (obj[STORAGE_KEYS.chainPresets] as ChainPreset[] | undefined) ?? [];
      setPresets(list);
    });
  }, [open]);

  const availableOptions = useMemo(
    () => (bundle?.chatApps ?? []).map(a => ({ value: a.id, label: PLATFORM_DISPLAY[a.id]?.name ?? a.id })),
    [bundle],
  );

  function move(i: number, dir: -1 | 1): void {
    const j = i + dir;
    if (j < 0 || j >= platformIds.length) return;
    const next = [...platformIds];
    [next[i], next[j]] = [next[j], next[i]];
    setPlatformIds(next);
  }

  async function savePreset() {
    if (!presetName.trim()) { message.warning('请填入预设名'); return; }
    if (platformIds.length === 0) { message.warning('链至少包含一个平台'); return; }
    const next: ChainPreset[] = [
      ...presets.filter(p => p.name !== presetName.trim()),
      { id: `p_${Date.now()}`, name: presetName.trim(), platformIds, template },
    ];
    await chrome.storage.local.set({ [STORAGE_KEYS.chainPresets]: next });
    setPresets(next);
    setPresetName('');
    message.success('已保存预设');
  }

  function loadPreset(p: ChainPreset) {
    setPlatformIds(p.platformIds);
    setTemplate(p.template);
  }

  async function deletePreset(id: string) {
    const next = presets.filter(p => p.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.chainPresets]: next });
    setPresets(next);
  }

  function confirm() {
    if (platformIds.length === 0) { message.warning('链至少包含一个平台'); return; }
    onConfirm(platformIds, template);
    onClose();
  }

  return (
    <Drawer title="编辑接龙链" open={open} onClose={onClose} width={480}
      extra={<Button type="primary" onClick={confirm}>确定</Button>}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div>
          <div style={{ marginBottom: 8 }}>链顺序（从上到下依次接龙）：</div>
          <List
            bordered
            dataSource={platformIds}
            renderItem={(id, i) => (
              <List.Item
                actions={[
                  <Button key="up" icon={<ArrowUpOutlined />} size="small" onClick={() => move(i, -1)} />,
                  <Button key="dn" icon={<ArrowDownOutlined />} size="small" onClick={() => move(i, 1)} />,
                  <Button key="rm" icon={<DeleteOutlined />} size="small" danger onClick={() =>
                    setPlatformIds(platformIds.filter((_, j) => j !== i))} />,
                ]}
              >
                {i + 1}. {availableOptions.find(o => o.value === id)?.label ?? id}
              </List.Item>
            )}
          />
        </div>

        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="添加平台到链…"
          value={[]}
          options={availableOptions.filter(o => !platformIds.includes(o.value))}
          onChange={(vals: string[]) => setPlatformIds([...platformIds, ...vals])}
        />

        <div>
          <div style={{ marginBottom: 8 }}>链模板（可用变量：{'{prompt} {harvested} {prevPlatform}'}）</div>
          <Input.TextArea
            rows={4}
            value={template}
            onChange={e => setTemplate(e.target.value)}
            placeholder={DEFAULT_CHAIN_TEMPLATE}
          />
        </div>

        <div>
          <div style={{ marginBottom: 8 }}>命名预设</div>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={presetName}
              placeholder="例如：评审链"
              onChange={e => setPresetName(e.target.value)}
            />
            <Button onClick={savePreset}>保存预设</Button>
          </Space.Compact>
        </div>

        {presets.length > 0 && (
          <List
            size="small"
            header="已保存预设"
            dataSource={presets}
            renderItem={p => (
              <List.Item actions={[
                <Button key="load" size="small" onClick={() => loadPreset(p)}>加载</Button>,
                <Button key="del" size="small" danger onClick={() => deletePreset(p.id)}>删除</Button>,
              ]}>
                <strong>{p.name}</strong> — {p.platformIds.join(' → ')}
              </List.Item>
            )}
          />
        )}
      </Space>
    </Drawer>
  );
}
