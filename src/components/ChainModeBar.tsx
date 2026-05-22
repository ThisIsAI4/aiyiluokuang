import React, { useState } from 'react';
import { Switch, Button, Tag, Space, message } from 'antd';
import { PlayCircleOutlined, RightOutlined, RedoOutlined, StopOutlined, EditOutlined } from '@ant-design/icons';
import { useStore } from 'zustand';
import { chainStore } from '../services/chainStore';
import { useAppStore } from '../store';
import { PLATFORM_DISPLAY } from '../platforms/configs';
import { ChainEditor } from './ChainEditor';
import { DEFAULT_CHAIN_TEMPLATE } from '../utils/chainTemplate';

type Props = {
  inputValue: string;
  onStartChain: () => void;
};

export function ChainModeBar({ inputValue, onStartChain }: Props) {
  const chainMode = useAppStore(s => s.chainMode);
  const setChainMode = useAppStore(s => s.setChainMode);
  const chain = useStore(chainStore);
  const [editorOpen, setEditorOpen] = useState(false);
  const bundle = useAppStore(s => s.bundle);

  const platformNames = chain.steps.map(s => PLATFORM_DISPLAY[s.platformId]?.name ?? s.platformId);

  const statusBadge = (() => {
    switch (chain.status) {
      case 'idle': return <Tag>idle</Tag>;
      case 'waiting_user': return <Tag color="processing">步骤 {chain.currentStep + 1}/{chain.steps.length} 等待选区</Tag>;
      case 'running': return <Tag color="processing">运行中</Tag>;
      case 'done': return <Tag color="success">完成 ✓</Tag>;
      case 'aborted': return <Tag color="error">已中断</Tag>;
    }
  })();

  const primary = (() => {
    if (chain.status === 'idle') {
      return <Button type="primary" icon={<PlayCircleOutlined />} onClick={onStartChain}>发起链</Button>;
    }
    if (chain.status === 'waiting_user') {
      return <Button type="primary" icon={<RightOutlined />} onClick={async () => {
        await chain.next();
        if (chainStore.getState().lastError) message.warning(chainStore.getState().lastError!);
      }}>下一步</Button>;
    }
    if (chain.status === 'done') {
      return <Button icon={<RedoOutlined />} onClick={() => chain.reset()}>重启</Button>;
    }
    return <Button icon={<RedoOutlined />} onClick={() => chain.reset()}>清空</Button>;
  })();

  return (
    <Space wrap>
      <Switch checked={chainMode} onChange={setChainMode} checkedChildren="链模式" unCheckedChildren="链模式" />
      {chainMode && (
        <>
          {platformNames.length > 0
            ? <span style={{ opacity: 0.85 }}>{platformNames.join(' → ')}</span>
            : <span style={{ opacity: 0.6 }}>（未配置）</span>}
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>编辑链</Button>
          {statusBadge}
          {primary}
          {chain.status === 'waiting_user' && (
            <Button size="small" danger icon={<StopOutlined />} onClick={() => chain.abort()}>中断</Button>
          )}
        </>
      )}
      <ChainEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        initialPlatformIds={chain.steps.map(s => s.platformId)}
        initialTemplate={chain.template || DEFAULT_CHAIN_TEMPLATE}
        onConfirm={(ids, template) => {
          chainStore.setState({
            steps: ids.map(id => ({ platformId: id })),
            template,
          });
        }}
      />
    </Space>
  );
}
