import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button, Dropdown, Tooltip } from 'antd';
import {
  ReloadOutlined, ExpandOutlined, CompressOutlined, MoreOutlined, CloseOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { sendToIframe, addPostMessageListener } from '../utils/messaging';
import { PLATFORM_DISPLAY } from '../platforms/configs';
import { useAppStore } from '../store';
import type { ChatAppConfig } from '../types';

export interface ChatPanelHandle {
  sendText: (text: string) => Promise<void>;
  newChat: () => Promise<void>;
  reload: () => void;
  fullscreen: () => void;
  getIframe: () => HTMLIFrameElement | null;
  getAppId: () => string;
  getTitle: () => string;
}

interface Props {
  app: ChatAppConfig;
}

const ChatPanel = forwardRef<ChatPanelHandle, Props>(function ChatPanel({ app }, ref) {
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [full, setFull] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const display = PLATFORM_DISPLAY[app.id] || { name: app.id, company: '' };

  // Only this panel's iframe is allowed through the filter, so per-panel state stays
  // tied to its real source — no risk of the page-level listener answering first.
  useEffect(() => {
    const handler = addPostMessageListener(async (action) => {
      switch (action) {
        case 'getConfig': return app;
        case 'getShortcutConfig': return useAppStore.getState().shortcutConfig;
        case 'contentReady': setReady(true); return null;
        case 'contentError': return null;
        case 'logError': return null;
        case 'intentObserved': return null;
        // shortcutTriggered: let the page-level listener handle it.
        default: return undefined; // not handled — defer to other listeners
      }
    }, source => source != null && source === iframeRef.current?.contentWindow);
    return () => window.removeEventListener('message', handler);
  }, [app]);

  useImperativeHandle(ref, () => ({
    async sendText(text: string) {
      if (!iframeRef.current) return;
      try {
        await sendToIframe(iframeRef.current, 'sendText', { text }, 5000);
      } catch (err) {
        console.warn('sendText failed', err);
      }
    },
    async newChat() {
      if (!iframeRef.current) return;
      try {
        await sendToIframe(iframeRef.current, 'newChatPreprocess', undefined, 5000);
      } catch {}
      setReady(false);
      setReloadKey(k => k + 1);
    },
    reload() { setReady(false); setReloadKey(k => k + 1); },
    fullscreen() { setFull(f => !f); },
    getIframe() { return iframeRef.current; },
    getAppId() { return app.id; },
    getTitle() { return display.name; },
  }), [app, display, full]);

  return (
    <div className={`chat-panel${full ? ' fullscreen' : ''}`} data-app-id={app.id}>
      <div className="chat-panel-header">
        <span className="chat-panel-title" title={display.name}>{display.name}</span>
        <Tooltip title={t('panel.reload')}>
          <Button size="small" type="text" icon={<ReloadOutlined />} onClick={() => setReloadKey(k => k + 1)} />
        </Tooltip>
        <Tooltip title={full ? t('panel.exitFullscreen') : t('panel.fullscreen')}>
          <Button size="small" type="text" icon={full ? <CompressOutlined /> : <ExpandOutlined />} onClick={() => setFull(f => !f)} />
        </Tooltip>
        <Dropdown
          menu={{
            items: [
              { key: 'open', label: t('panel.openInTab'), onClick: () => window.open(app.url, '_blank') },
              { key: 'reload', label: t('panel.reload'), onClick: () => setReloadKey(k => k + 1) },
            ],
          }}
        >
          <Button size="small" type="text" icon={<MoreOutlined />} />
        </Dropdown>
      </div>
      <iframe
        key={reloadKey}
        ref={iframeRef}
        src={app.url}
        title={app.id}
        loading="lazy"
      />
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(255,255,255,.4)', pointerEvents: 'none',
        }} />
      )}
    </div>
  );
});

export default ChatPanel;
