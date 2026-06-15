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
import HistoryPopup from '../components/HistoryPopup';
import { stitchLongCapture } from '../services/capture';
import { getSendKeyMode, loadShortcutConfig, formatShortcut, applyShortcutConfig } from '../utils/shortcuts';
import { useInputHistory } from '../utils/useInputHistory';
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
  const [lastSent, setLastSent] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [pendingCtx, setPendingCtx] = useState<ContextPayload | null>(null);
  const chainMode = useAppStore(s => s.chainMode);

  const inputRef = useRef<any>(null);
  const panelRefs = useRef<Map<string, ChatPanelHandle>>(new Map());
  const inputHistory = useInputHistory();

  const activePreset = useMemo(() => {
    return options.layoutPresets.find(p => p.id === options.activeLayoutPresetId)
      || options.layoutPresets[0];
  }, [options]);

  const activeAppIds = useMemo(() => activePreset?.appIdGroups.flat() || [], [activePreset]);

  useEffect(() => { loadShortcutConfig(); inputHistory.load(); }, []);
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
    inputHistory.push(trimmed);
    setLastSent(trimmed);
    if (chainMode) {
      const steps = chainStore.getState().steps;
      if (steps.length === 0) { message.warning(t('chain.needSteps')); return; }
      chainStore.getState().start(trimmed, steps);
      setText('');
      return;
    }
    panelRefs.current.forEach(p => p.sendText(trimmed));
    setText('');
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    const cmd = ev.metaKey || ev.ctrlKey;

    // Ctrl+R → open history popup
    if (ev.key === 'r' && cmd) {
      ev.preventDefault();
      setHistoryOpen(true);
      return;
    }

    const mode = getSendKeyMode();
    if (mode === 'enter' && ev.key === 'Enter' && !ev.shiftKey && !cmd && !ev.nativeEvent.isComposing) {
      ev.preventDefault();
      handleSubmit();
    }
    if (mode === 'cmdOrCtrlEnter' && ev.key === 'Enter' && cmd && !ev.nativeEvent.isComposing) {
      ev.preventDefault();
      handleSubmit();
    }

    // Skip ↑/↓ inline navigation while popup is open (popup owns the keys)
    if (historyOpen) return;

    // ArrowUp at cursor start → history back; ArrowDown at cursor end → history forward
    if (ev.key === 'ArrowUp' && ev.currentTarget.selectionStart === 0) {
      const hit = inputHistory.navigate('up', text);
      if (hit !== null) { ev.preventDefault(); setText(hit); }
    }
    if (ev.key === 'ArrowDown' && ev.currentTarget.selectionStart === ev.currentTarget.value.length) {
      const hit = inputHistory.navigate('down', text);
      if (hit !== null) { ev.preventDefault(); setText(hit); }
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
  }, [bundle, shortcutConfig]);

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
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            height: '100%',
            color: 'var(--v-mute)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--v-body)' }}>
              {t('app.noPanels') || 'No panels configured'}
            </div>
            <Button type="primary" onClick={() => setLayoutOpen(true)}>
              {t('app.configureLayout') || 'Configure layout'}
            </Button>
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
        {chainMode && (
          <div className="input-bar-chain">
            <ChainModeBar
              inputValue={text}
              onStartChain={async () => {
                const steps = chainStore.getState().steps;
                if (steps.length === 0) { message.warning(t('chain.needSteps')); return; }
                if (!text.trim()) { message.warning(t('chain.needPrompt')); return; }
                await chainStore.getState().start(text, steps);
                setText('');
              }}
            />
          </div>
        )}
        {pendingCtx && (
          <div className="input-bar-context">
            <ContextPreviewChip
              ctx={pendingCtx}
              onDismiss={() => { setPendingCtx(null); setText(''); }}
            />
          </div>
        )}
        <div className="input-bar-row">
          {!chainMode && (
            <ChainModeBar
              inputValue={text}
              onStartChain={async () => {
                const steps = chainStore.getState().steps;
                if (steps.length === 0) { message.warning(t('chain.needSteps')); return; }
                if (!text.trim()) { message.warning(t('chain.needPrompt')); return; }
                await chainStore.getState().start(text, steps);
                setText('');
              }}
            />
          )}
          <Tabs
            size="small"
            activeKey={options.activeLayoutPresetId}
            onChange={key => setActiveLayout(key)}
            items={options.layoutPresets.map(p => ({ key: p.id, label: p.name || p.id }))}
            className="layout-tabs"
          />
          <div className="input-bar-tools">
            <Tooltip title={t('menu.settings')} placement="top">
              <Button type="text" icon={<MenuOutlined />} onClick={() => setSettingsOpen(true)} />
            </Tooltip>
            <Tooltip title={t('app.capture')} placement="top">
              <Button type="text" icon={<CameraOutlined />} loading={capturing} onClick={() => doScreenshot(false)} />
            </Tooltip>
            <Tooltip title={t('app.captureLong')} placement="top">
              <Button type="text" icon={<ColumnHeightOutlined />} loading={capturing} onClick={() => doScreenshot(true)} />
            </Tooltip>
            <Tooltip title={t('app.optimize')} placement="top">
              <Button type="text" icon={<ThunderboltOutlined />} onClick={() => handleShortcut('optimizePrompt')} />
            </Tooltip>
            <Tooltip title={t('app.layoutAdd')} placement="top">
              <Button type="text" icon={<PlusOutlined />} onClick={() => setLayoutOpen(true)} />
            </Tooltip>
            <Tooltip title={t('app.newChat')} placement="top">
              <Button type="text" icon={<ReloadOutlined />} onClick={() => panelRefs.current.forEach(p => p.newChat())} />
            </Tooltip>
          </div>
          <div className="history-popup-anchor">
            {historyOpen && (
              <HistoryPopup
                query={text}
                items={inputHistory.search(text)}
                onSelect={hit => { setText(hit); setHistoryOpen(false); inputRef.current?.focus?.(); }}
                onClose={() => { setHistoryOpen(false); inputRef.current?.focus?.(); }}
              />
            )}
            <Input.TextArea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={lastSent || t('app.inputPlaceholder')}
              autoSize={{ minRows: 1, maxRows: 5 }}
            />
          </div>
          <Tooltip title={t('app.send')} placement="top">
            <Button className="input-bar-send" type="primary" icon={<SendOutlined />} onClick={handleSubmit} />
          </Tooltip>
        </div>
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
