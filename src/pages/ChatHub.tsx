import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Tabs, Tooltip, Modal, App as AntApp } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  SendOutlined, ReloadOutlined, CameraOutlined, ColumnHeightOutlined, ThunderboltOutlined,
  PlusOutlined, MenuOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../store';
import ChatPanel, { ChatPanelHandle } from '../components/ChatPanel';
import SettingsDrawer from '../components/SettingsDrawer';
import LayoutManager from '../components/LayoutManager';
import PromptLibraryModal from '../components/PromptLibraryModal';
import CustomConfigModal from '../components/CustomConfigModal';
import ShortcutModal from '../components/ShortcutModal';
import { stitchLongCapture } from '../services/capture';
import { getSendKeyMode, loadShortcutConfig, formatShortcut, applyShortcutConfig } from '../utils/shortcuts';
import { addPostMessageListener, sendToParent } from '../utils/messaging';
import { PROTOCOL_SOURCE } from '../utils/constants';
import { consumePending, type ContextPayload } from '../services/contextPayload';
import { ContextPreviewChip } from '../components/ContextPreviewChip';
import { ChainModeBar } from '../components/ChainModeBar';
import { AnswerHarvestButton } from '../components/AnswerHarvestButton';
import { chainStore, bindPanelRegistry } from '../services/chainStore';

declare global {
  interface Window { __SCH_WINDOW__?: Window; }
}

export default function ChatHubPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const options = useAppStore(s => s.options);
  const bundle = useAppStore(s => s.bundle);
  const shortcutConfig = useAppStore(s => s.shortcutConfig);
  const setActiveLayout = useAppStore(s => s.setActiveLayout);
  const updateLayout = useAppStore(s => s.updateLayout);
  const addLayout = useAppStore(s => s.addLayout);
  const removeLayout = useAppStore(s => s.removeLayout);

  const [text, setText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [pendingCtx, setPendingCtx] = useState<ContextPayload | null>(null);
  const chainMode = useAppStore(s => s.chainMode);

  const inputRef = useRef<any>(null);
  const panelRefs = useRef<Map<string, ChatPanelHandle>>(new Map());

  const activePreset = useMemo(() => {
    return options.layoutPresets.find(p => p.id === options.activeLayoutPresetId)
      || options.layoutPresets[0];
  }, [options]);

  const activeAppIds = useMemo(() => activePreset?.appIdGroups.flat() || [], [activePreset]);

  useEffect(() => { loadShortcutConfig(); }, []);
  useEffect(() => { applyShortcutConfig(shortcutConfig); }, [shortcutConfig]);

  useEffect(() => {
    consumePending().then(p => {
      if (p) {
        setPendingCtx(p);
        setText(p.text);
      }
    });
  }, []);

  useEffect(() => {
    bindPanelRegistry({
      resolve(platformId) {
        const ref = panelRefs.current.get(platformId);
        if (!ref) return null;
        return {
          sendText: (t: string) => ref.sendText(t),
          harvestSelection: () => ref.harvestSelection(),
        };
      },
      platformName(platformId) {
        return bundle?.chatApps.find(a => a.id === platformId)?.id ?? platformId;
      },
    });
  }, [bundle]);

  // Page-level listener handles ONLY events that aren't iframe-scoped.
  // Per-panel handlers (in ChatPanel.tsx) own getConfig / contentReady / getShortcutConfig
  // via a source-filter. Listing them here too would race with the panel's reply.
  useEffect(() => {
    const handler = addPostMessageListener(async (action, data) => {
      switch (action) {
        case 'contentError':
          console.warn('[chat] content error', data);
          return null;
        case 'logError':
          console.warn('[chat] log error', data);
          return null;
        case 'shortcutTriggered':
          handleShortcut((data as { action: string; matchObj?: string[] }).action,
            (data as any).matchObj);
          return null;
        case 'intentObserved':
          return null;
        default:
          return undefined; // not handled
      }
    });
    return () => window.removeEventListener('message', handler);
  }, [bundle, shortcutConfig]);

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (chainMode) {
      const steps = chainStore.getState().steps;
      if (steps.length === 0) { message.warning('请先在「编辑链」里配置链顺序'); return; }
      chainStore.getState().start(trimmed, steps);
      setText('');
      return;
    }
    panelRefs.current.forEach(p => p.sendText(trimmed));
    setText('');
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mode = getSendKeyMode();
    const cmd = ev.metaKey || ev.ctrlKey;
    if (mode === 'enter' && ev.key === 'Enter' && !ev.shiftKey && !cmd) {
      ev.preventDefault();
      handleSubmit();
    }
    if (mode === 'cmdOrCtrlEnter' && ev.key === 'Enter' && cmd) {
      ev.preventDefault();
      handleSubmit();
    }
  }

  function handleShortcut(action: string, matchObj?: string[]) {
    const digit = matchObj && matchObj[1] ? parseInt(matchObj[1], 10) : undefined;
    switch (action) {
      case 'focusInput':
        inputRef.current?.focus?.();
        break;
      case 'newChat':
        panelRefs.current.forEach(p => p.newChat());
        break;
      case 'reloadChat':
        panelRefs.current.forEach(p => p.reload());
        break;
      case 'switchLayout': {
        if (!digit) return;
        const idx = digit - 1;
        const target = options.layoutPresets[idx];
        if (target) setActiveLayout(target.id);
        break;
      }
      case 'insertPrompt': {
        if (!digit) return;
        const prompt = useAppStore.getState().promptLibrary[digit - 1];
        if (prompt) setText(t => t + (t ? '\n' : '') + prompt.content);
        break;
      }
      case 'optimizePrompt':
        message.info(t('optimize.requiresKey'));
        break;
    }
  }

  useEffect(() => {
    const ev = (e: KeyboardEvent) => {
      // local matching for keys when focus is in the extension page (not iframe)
      import('../utils/shortcuts').then(({ matchShortcut }) => {
        const hit = matchShortcut(e);
        if (!hit) return;
        e.preventDefault();
        e.stopPropagation();
        handleShortcut(hit.action, hit.matchObj && Array.from(hit.matchObj));
      });
    };
    window.addEventListener('keydown', ev, true);
    return () => window.removeEventListener('keydown', ev, true);
  });

  async function doScreenshot(long: boolean) {
    setCapturing(true);
    try {
      const visiblePanels = Array.from(panelRefs.current.values()).filter(p => p.getIframe());
      if (!visiblePanels.length) return;
      if (long) {
        await stitchLongCapture(visiblePanels);
      } else {
        // For single visible-area capture, ask background to capture visible tab and download.
        const { url } = (await chrome.runtime.sendMessage({
          source: PROTOCOL_SOURCE, action: 'captureVisibleTab', data: { format: 'png' },
        })) as { url: string };
        const a = document.createElement('a');
        a.href = url;
        a.download = `chathub-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      message.error(String(err));
    } finally {
      setCapturing(false);
    }
  }

  const colCount = options.colMaxCount > 0
    ? Math.min(options.colMaxCount, activeAppIds.length)
    : activeAppIds.length || 1;

  return (
    <div className="chathub-root">
      <div
        className="chathub-main"
        style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
      >
        {activeAppIds.length === 0 ? (
          <div style={{ padding: 32 }}>
            <Button onClick={() => setLayoutOpen(true)} type="primary">Configure layout</Button>
          </div>
        ) : activeAppIds.map(id => {
          const app = bundle?.chatApps.find(a => a.id === id);
          if (!app) return null;
          return (
            <div key={id} style={{ position: 'relative' }}>
              <AnswerHarvestButton platformId={id} />
              <ChatPanel
                app={app}
                ref={el => {
                  if (el) panelRefs.current.set(id, el);
                  else panelRefs.current.delete(id);
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="chathub-input-bar">
        <ChainModeBar
          inputValue={text}
          onStartChain={async () => {
            const steps = chainStore.getState().steps;
            if (steps.length === 0) { message.warning('请先在「编辑链」里配置链顺序'); return; }
            if (!text.trim()) { message.warning('请先输入起始 prompt'); return; }
            await chainStore.getState().start(text, steps);
            setText('');
          }}
        />
        <Tabs
          size="small"
          activeKey={options.activeLayoutPresetId}
          onChange={key => setActiveLayout(key)}
          items={options.layoutPresets.map(p => ({ key: p.id, label: p.name || p.id }))}
          className="layout-tabs"
          tabBarExtraContent={
            <Tooltip title={t('app.layoutAdd')}>
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setLayoutOpen(true)} />
            </Tooltip>
          }
        />
        <Tooltip title={t('app.optimize')}>
          <Button icon={<ThunderboltOutlined />} onClick={() => handleShortcut('optimizePrompt')} />
        </Tooltip>
        <Tooltip title={t('app.capture')}>
          <Button icon={<CameraOutlined />} loading={capturing} onClick={() => doScreenshot(false)} />
        </Tooltip>
        <Tooltip title={t('app.captureLong')}>
          <Button icon={<ColumnHeightOutlined />} loading={capturing} onClick={() => doScreenshot(true)} />
        </Tooltip>
        <Tooltip title={t('app.newChat')}>
          <Button icon={<ReloadOutlined />} onClick={() => panelRefs.current.forEach(p => p.newChat())} />
        </Tooltip>
        {pendingCtx && (
          <ContextPreviewChip
            ctx={pendingCtx}
            onDismiss={() => { setPendingCtx(null); setText(''); }}
          />
        )}
        <Input.TextArea
          ref={inputRef}
          rows={3}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('app.inputPlaceholder')}
          autoSize={{ minRows: 1, maxRows: 6 }}
        />
        <Tooltip title={t('app.send')}>
          <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit} />
        </Tooltip>
        <Tooltip title={t('menu.settings')}>
          <Button icon={<MenuOutlined />} onClick={() => setSettingsOpen(true)} />
        </Tooltip>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenPromptLibrary={() => setPromptOpen(true)}
        onOpenCustomConfig={() => setCustomOpen(true)}
        onOpenShortcut={() => setShortcutOpen(true)}
      />
      <LayoutManager
        open={layoutOpen}
        onClose={() => setLayoutOpen(false)}
      />
      <PromptLibraryModal open={promptOpen} onClose={() => setPromptOpen(false)} />
      <CustomConfigModal open={customOpen} onClose={() => setCustomOpen(false)} />
      <ShortcutModal open={shortcutOpen} onClose={() => setShortcutOpen(false)} />
    </div>
  );
}
