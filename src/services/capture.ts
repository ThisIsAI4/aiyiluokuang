import { sendToIframe } from '../utils/messaging';
import {
  CAPTURE_START_TIMEOUT, CAPTURE_STEP_TIMEOUT, CAPTURE_END_TIMEOUT, PROTOCOL_SOURCE,
} from '../utils/constants';
import {
  captureVisibleTab, computeOutputRatio, blobToImage, canvasToBlob,
  loadImage, openImageInNewTab, screenshotConfig,
} from '../utils/screenshot';
import type { ChatPanelHandle } from '../components/ChatPanel';

const FPS_MS = 1000 / screenshotConfig.fps;

interface StitchPanelInfo {
  iframe: HTMLIFrameElement;
  title: string;
  iframeRect: DOMRect;
  innerInfo: {
    scrollHeight: number;
    scrollWidth: number;
    clientHeight: number;
    clientWidth: number;
    pageX: number;
    pageY: number;
  };
}

async function requestFromBackground(format: 'png' | 'jpeg', quality = 70): Promise<HTMLImageElement> {
  const { url } = (await chrome.runtime.sendMessage({
    source: PROTOCOL_SOURCE, action: 'captureVisibleTab', data: { format, quality },
  })) as { url: string };
  return loadImage(url);
}

export async function stitchLongCapture(panels: ChatPanelHandle[]): Promise<void> {
  const started = new Set<HTMLIFrameElement>();
  const initResults = await Promise.all(panels.map(async p => {
    const ifr = p.getIframe();
    if (!ifr) return null;
    try {
      const innerInfo = await sendToIframe<{
        scrollHeight: number; scrollWidth: number; clientHeight: number; clientWidth: number;
        pageX: number; pageY: number;
      }>(ifr, 'captureStart', undefined, CAPTURE_START_TIMEOUT);
      started.add(ifr);
      if (!innerInfo || innerInfo.scrollHeight === 0) return null;
      return {
        iframe: ifr,
        title: p.getTitle(),
        iframeRect: ifr.getBoundingClientRect(),
        innerInfo,
      } as StitchPanelInfo;
    } catch (err) {
      console.warn('captureStart failed', err);
      started.add(ifr);
      return null;
    }
  }));
  const panelInfos = initResults.filter((x): x is StitchPanelInfo => !!x);

  if (panelInfos.length === 0) {
    throw new Error('No iframes responded to captureStart');
  }

  try {
    const totalScrollHeight = Math.max(...panelInfos.map(p => p.innerInfo.scrollHeight));
    const stepHeight = Math.max(
      1,
      Math.min(...panelInfos.map(p => p.innerInfo.clientHeight)) - screenshotConfig.overlapPx,
    );
    const dpr = window.devicePixelRatio;
    const totalWidthCss = panelInfos.reduce((sum, p) => sum + p.innerInfo.clientWidth, 0);
    const ratio = computeOutputRatio(totalWidthCss, totalScrollHeight);
    const finalWidth = panelInfos.reduce((sum, p) => sum + Math.ceil(p.innerInfo.clientWidth * ratio), 0);
    const finalScrollHeight = Math.ceil(totalScrollHeight * ratio);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = finalWidth;
    canvas.height = finalScrollHeight + 64; // header
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let scrollY = 0;
    while (scrollY < totalScrollHeight) {
      // Tell every panel to scroll, in parallel.
      const scrollResults = await Promise.allSettled(panelInfos.map(p =>
        sendToIframe<{ left: number; top: number }>(p.iframe, 'triggerScroll',
          { left: 0, top: scrollY }, CAPTURE_STEP_TIMEOUT),
      ));
      const scrolls = scrollResults.map(r => r.status === 'fulfilled' ? r.value : { left: 0, top: 0 });
      await new Promise(r => setTimeout(r, FPS_MS));

      const tabImg = await requestFromBackground('png');
      let drawX = 0;
      for (let i = 0; i < panelInfos.length; i++) {
        const p = panelInfos[i];
        const { left: sx, top: sy } = scrolls[i];
        const srcW = Math.ceil(p.innerInfo.clientWidth * dpr);
        const srcH = Math.min(
          Math.ceil((p.innerInfo.clientHeight + screenshotConfig.overlapPx) * dpr),
          Math.max(0, Math.ceil((p.innerInfo.scrollHeight - scrollY) * dpr)),
        );
        const destW = Math.ceil(p.innerInfo.clientWidth * ratio);
        const destH = Math.min(
          Math.ceil((p.innerInfo.clientHeight + screenshotConfig.overlapPx) * ratio),
          Math.max(0, Math.ceil((p.innerInfo.scrollHeight - scrollY) * ratio)),
        );
        if (scrollY < p.innerInfo.scrollHeight) {
          const srcX = Math.ceil((p.iframeRect.left + p.innerInfo.pageX - sx) * dpr);
          const srcY = Math.ceil((p.iframeRect.top + p.innerInfo.pageY + (scrollY - sy)) * dpr);
          ctx.drawImage(tabImg, srcX, srcY, srcW, srcH, drawX, 64 + Math.ceil(scrollY * ratio), destW, destH);
        }
        drawX += destW;
      }
      scrollY += stepHeight;
    }

    // header banner
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, 64);
    ctx.fillStyle = '#888';
    ctx.fillRect(0, 63, canvas.width, 1);
    ctx.fillStyle = '#333';
    ctx.font = `18px ${screenshotConfig.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(panelInfos.map(p => p.title).join(' / '), canvas.width / 2, 32);

    const blob = await canvasToBlob(canvas, 'image/png', screenshotConfig.quality);
    openImageInNewTab(URL.createObjectURL(blob));
  } finally {
    await Promise.allSettled(Array.from(started).map(ifr =>
      sendToIframe(ifr, 'captureEnd', undefined, CAPTURE_END_TIMEOUT)));
  }
}
