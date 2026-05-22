import React from 'react';
import { Button, message } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useStore } from 'zustand';
import { chainStore } from '../services/chainStore';

type Props = {
  platformId: string;
};

export function AnswerHarvestButton({ platformId }: Props) {
  const chain = useStore(chainStore);
  if (chain.status !== 'waiting_user') return null;
  const currentPlatformId = chain.steps[chain.currentStep]?.platformId;
  if (currentPlatformId !== platformId) return null;
  return (
    <Button
      size="small"
      type="primary"
      icon={<RightOutlined />}
      style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
      onClick={async () => {
        await chain.next();
        const err = chainStore.getState().lastError;
        if (err) message.warning(err);
      }}
    >
      采集选区 → 下一步
    </Button>
  );
}
