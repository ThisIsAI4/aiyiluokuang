import React, { useState } from 'react';
import { Switch, Button, Tag, Space, message } from 'antd';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const chainMode = useAppStore(s => s.chainMode);
  const setChainMode = useAppStore(s => s.setChainMode);
  const chain = useStore(chainStore);
  const [editorOpen, setEditorOpen] = useState(false);

  const platformNames = chain.steps.map(s => PLATFORM_DISPLAY[s.platformId]?.name ?? s.platformId);

  const statusBadge = (() => {
    switch (chain.status) {
      case 'idle': return <Tag>{t('chain.statusIdle')}</Tag>;
      case 'waiting_user': return <Tag color="processing">{t('chain.statusWaiting', { current: chain.currentStep + 1, total: chain.steps.length })}</Tag>;
      case 'running': return <Tag color="processing">{t('chain.statusIdle')}</Tag>;
      case 'done': return <Tag color="success">{t('chain.statusDone')}</Tag>;
      case 'aborted': return <Tag color="error">{t('chain.statusAborted')}</Tag>;
    }
  })();

  const primary = (() => {
    if (chain.status === 'idle') {
      return <Button type="primary" icon={<PlayCircleOutlined />} onClick={onStartChain}>{t('chain.start')}</Button>;
    }
    if (chain.status === 'waiting_user') {
      return <Button type="primary" icon={<RightOutlined />} onClick={async () => {
        await chain.next();
        if (chainStore.getState().lastError) message.warning(chainStore.getState().lastError!);
      }}>{t('chain.next')}</Button>;
    }
    if (chain.status === 'done') {
      return <Button icon={<RedoOutlined />} onClick={() => chain.reset()}>{t('chain.restart')}</Button>;
    }
    return <Button icon={<RedoOutlined />} onClick={() => chain.reset()}>{t('chain.clear')}</Button>;
  })();

  return (
    <Space wrap>
      <Switch checked={chainMode} onChange={setChainMode} checkedChildren={t('chain.toggle')} unCheckedChildren={t('chain.toggle')} />
      {chainMode && (
        <>
          {platformNames.length > 0
            ? <span style={{ opacity: 0.85 }}>{platformNames.join(' → ')}</span>
            : <span style={{ opacity: 0.6 }}>({t('chain.statusIdle')})</span>}
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditorOpen(true)}>{t('chain.edit')}</Button>
          {statusBadge}
          {primary}
          {chain.status === 'waiting_user' && (
            <Button size="small" danger icon={<StopOutlined />} onClick={() => chain.abort()}>{t('chain.abort')}</Button>
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
