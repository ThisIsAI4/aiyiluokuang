import React from 'react';
import { Tag, Tooltip } from 'antd';
import { CloseOutlined, FilePdfOutlined, FileTextOutlined, HighlightOutlined } from '@ant-design/icons';
import type { ContextPayload } from '../services/contextPayload';

const KIND_ICON: Record<ContextPayload['kind'], React.ReactNode> = {
  selection: <HighlightOutlined />,
  article: <FileTextOutlined />,
  pdf: <FilePdfOutlined />,
};

type Props = {
  ctx: ContextPayload;
  onDismiss: () => void;
};

export function ContextPreviewChip({ ctx, onDismiss }: Props) {
  const preview = ctx.text.slice(0, 500) + (ctx.text.length > 500 ? '…' : '');
  const charLabel = ctx.charCount.toLocaleString();
  return (
    <Tooltip title={<pre style={{ maxWidth: 480, whiteSpace: 'pre-wrap' }}>{preview}</pre>}>
      <Tag
        icon={KIND_ICON[ctx.kind]}
        closable
        closeIcon={<CloseOutlined onClick={onDismiss} />}
        style={{ margin: '4px 0', padding: '4px 10px', cursor: 'pointer' }}
        onClick={e => {
          if ((e.target as HTMLElement).closest('.anticon-close')) return;
          chrome.tabs.create({ url: ctx.sourceUrl });
        }}
      >
        来自 “{ctx.sourceTitle}” · {charLabel} 字{ctx.truncated ? ' · 已截断到 8,000' : ''}
      </Tag>
    </Tooltip>
  );
}
