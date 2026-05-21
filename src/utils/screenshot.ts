import { ScreenshotFormat } from './constants';

export interface RectInfo {
  x: number; y: number;
  pageX: number; pageY: number;
  width: number; height: number;
  scrollHeight: number; scrollWidth: number;
  clientHeight: number; clientWidth: number;
}

export const screenshotConfig = {
  defaultFormat: ScreenshotFormat.JPEG,
  quality: 0.7,
  fps: 1.5,
  overlapPx: 2,
  maxCanvasDim: 16384,
  maxCanvasArea: 268435456,
  font: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
};

export function pxRatio(v: number) {
  return Math.ceil(v * window.devicePixelRatio);
}
export function scaled(v: number, ratio: number) {
  return Math.ceil(v * ratio);
}

export function computeOutputRatio(width: number, height: number) {
  const dpr = window.devicePixelRatio;
  const ow = scaled(width, dpr);
  const oh = scaled(height, dpr);
  const dimRatio = Math.min(1, screenshotConfig.maxCanvasDim / ow, screenshotConfig.maxCanvasDim / oh);
  const areaRatio = Math.min(1, Math.sqrt(screenshotConfig.maxCanvasArea / Math.max(ow * oh, 1)));
  return dpr * Math.min(dimRatio, areaRatio);
}

export function getRectInfo(el: HTMLElement): RectInfo {
  const r = el.getBoundingClientRect();
  return {
    x: r.left, y: r.top,
    pageX: r.left + window.scrollX,
    pageY: r.top + window.scrollY,
    width: r.width, height: r.height,
    scrollHeight: el.scrollHeight, scrollWidth: el.scrollWidth,
    clientHeight: el.clientHeight, clientWidth: el.clientWidth,
  };
}

export function captureVisibleTab(format = screenshotConfig.defaultFormat): Promise<string> {
  return chrome.tabs.captureVisibleTab({
    format: format.split('/')[1] as 'jpeg' | 'png',
    quality: Math.round(screenshotConfig.quality * 100),
  });
}

export function loadImage(src: string, revoke = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { if (revoke) URL.revokeObjectURL(src); resolve(img); };
    img.onerror = () => { if (revoke) URL.revokeObjectURL(src); reject(new Error('image load failed')); };
    img.src = src;
  });
}

export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return loadImage(url, true);
}

export function canvasToBlob(c: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob(b => b ? resolve(b) : reject(new Error('canvas toBlob failed')), format, quality);
  });
}

const SEMANTIC_HIT = new Set(['chat', 'conversation', 'message', 'messages', 'thread', 'feed', 'content', 'main', 'transcript', 'assistant', 'prompt']);
const SEMANTIC_MISS = new Set(['sidebar', 'aside', 'nav', 'drawer', 'menu', 'toolbar', 'header', 'footer', 'banner', 'modal', 'dialog', 'popup', 'sheet', 'tablist', 'listbox', 'complementary', 'code', 'pre', 'codeblock', 'highlight', 'syntax', 'hljs', 'prism']);
const SHELL_HIT = new Set(['layout', 'wrapper', 'shell', 'root', 'page']);

const SAMPLE_POINTS = [
  { x: 0.5, y: 0.36, weight: 2.2 },
  { x: 0.5, y: 0.5, weight: 2.8 },
  { x: 0.38, y: 0.5, weight: 1.3 },
  { x: 0.62, y: 0.5, weight: 1.3 },
  { x: 0.5, y: 0.64, weight: 1.1 },
  { x: 0.38, y: 0.36, weight: 0.7 },
  { x: 0.62, y: 0.36, weight: 0.7 },
  { x: 0.38, y: 0.64, weight: 0.7 },
  { x: 0.62, y: 0.64, weight: 0.7 },
];
const totalWeight = SAMPLE_POINTS.reduce((s, p) => s + p.weight, 0);

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function tokenize(el: Element): Set<string> {
  return new Set([
    el.tagName,
    el.getAttribute('id') || '',
    el.getAttribute('class') || '',
    el.getAttribute('role') || '',
    el.getAttribute('aria-label') || '',
    el.getAttribute('data-testid') || '',
  ].join(' ').toLowerCase().split(/[\s\-_./]+/).filter(Boolean));
}

function parentOf(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null;
}

interface Cand {
  element: Element;
  visibleWidthRatio: number;
  visibleHeightRatio: number;
  visibleAreaRatio: number;
  centerScore: number;
  widthScore: number;
  heightScore: number;
  coverageScore: number;
  scrollIntent: number;
  semantic: number;
  shellPenalty: number;
  contentPenalty: number;
  depth: number;
  pointHits: number;
  directHits: number;
  finalScore: number;
}

function scoreScale(v: number, lo: number, hi: number) {
  if (v <= 0) return 0;
  if (v < lo) return clamp(v / lo, 0, 1);
  if (v <= hi) return 1;
  return clamp(1 - (v - hi) / Math.max(hi, 0.01), 0.35, 1);
}

function buildCandidate(el: Element, vp: { width: number; height: number; centerX: number; centerY: number; area: number }): Cand | null {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  const left = Math.max(r.left, 0);
  const top = Math.max(r.top, 0);
  const right = Math.min(r.right, vp.width);
  const bottom = Math.min(r.bottom, vp.height);
  if (right <= left || bottom <= top) return null;

  const visW = right - left;
  const visH = bottom - top;
  const visA = visW * visH;
  const wRatio = visW / vp.width;
  const hRatio = visH / vp.height;
  const aRatio = visA / vp.area;
  const widthScore = scoreScale(wRatio, 0.42, 1);
  const heightScore = scoreScale(hRatio, 0.28, 1);
  const coverageScore = scoreScale(aRatio, 0.2, 0.95);

  const cx = left + visW / 2;
  const cy = top + visH / 2;
  const dx = Math.abs(cx - vp.centerX) / vp.width;
  const dy = Math.abs(cy - vp.centerY) / vp.height;
  const centerScore = clamp(1 - Math.hypot(dx * 1.35, dy), 0, 1);

  const tokens = tokenize(el);
  let semantic = 0;
  tokens.forEach(t => {
    if (SEMANTIC_HIT.has(t)) semantic += 0.12;
    if (SEMANTIC_MISS.has(t)) semantic -= 0.18;
  });
  const role = (el.getAttribute('role') || '').toLowerCase();
  if (role === 'main' || role === 'feed' || role === 'log') semantic += 0.18;
  if (role === 'complementary' || role === 'dialog' || role === 'menu' || role === 'listbox') semantic -= 0.24;
  const semanticScore = clamp(semantic, -0.6, 0.6);

  let shell = 0;
  if (wRatio > 0.96 && hRatio > 0.96) shell += 0.2;
  if (wRatio < 0.34 && dx > 0.16) shell += 0.45;
  if (hRatio < 0.22 && dy > 0.16) shell += 0.35;
  for (const t of tokens) if (SHELL_HIT.has(t)) { shell += 0.15; break; }

  const tag = el.tagName;
  const contentPenalty = (tag === 'PRE' || tag === 'CODE') ? 0.6 : 0;

  const scrollDelta = Math.max((el as HTMLElement).scrollHeight - (el as HTMLElement).clientHeight, 0);
  const scrollIntent = scrollDelta > 48 ? 1 : scrollDelta > 0 ? 0.5 : 0;

  let depth = 0;
  let cur: Element | null = el;
  while (cur) { depth++; cur = parentOf(cur); }

  return {
    element: el,
    visibleWidthRatio: wRatio, visibleHeightRatio: hRatio, visibleAreaRatio: aRatio,
    centerScore, widthScore, heightScore, coverageScore,
    scrollIntent, semantic: semanticScore,
    shellPenalty: clamp(shell, 0, 0.8),
    contentPenalty,
    depth: Math.min(depth / 18, 1),
    pointHits: 0, directHits: 0, finalScore: 0,
  };
}

function aggregatePointHits(map: Map<Element, Cand>, vp: { width: number; height: number }) {
  for (const p of SAMPLE_POINTS) {
    const px = clamp(Math.round(vp.width * p.x), 0, vp.width - 1);
    const py = clamp(Math.round(vp.height * p.y), 0, vp.height - 1);
    let el: Element | null = document.elementFromPoint(px, py);
    let depth = 0;
    while (el) {
      const cand = map.get(el);
      if (cand) {
        const w = depth === 0 ? 1 : depth === 1 ? 0.45 : 0.18;
        cand.pointHits += p.weight * w;
        if (depth === 0) cand.directHits += 1;
        depth += 1;
      }
      el = parentOf(el);
    }
  }
}

function finalScore(c: Cand): number {
  const point = clamp(c.pointHits / totalWeight, 0, 1.2);
  const direct = clamp(c.directHits / 3, 0, 1);
  return point * 0.38 + direct * 0.08
    + c.coverageScore * 0.18 + c.widthScore * 0.09 + c.heightScore * 0.08
    + c.centerScore * 0.08 + c.scrollIntent * 0.05 + c.depth * 0.04
    + c.semantic * 0.1 - c.shellPenalty * 0.12 - c.contentPenalty;
}

export function detectScrollContainer(): HTMLElement {
  const candidates = Array.from(document.querySelectorAll('*')).filter(e => {
    if (!(e instanceof HTMLElement)) return false;
    if (isInsideCode(e)) return false;
    const cs = window.getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) <= 0) return false;
    const oy = cs.overflowY;
    return oy === 'auto' || oy === 'scroll' || oy === 'overlay';
  }) as HTMLElement[];

  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return document.documentElement;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const vp = { width: w, height: h, centerX: w / 2, centerY: h / 2, area: w * h };

  const map = new Map<Element, Cand>();
  for (const el of candidates) {
    const c = buildCandidate(el, vp);
    if (c) map.set(el, c);
  }
  if (map.size === 0) return document.documentElement;
  aggregatePointHits(map, vp);

  const arr = Array.from(map.values());
  const filtered = arr.filter(c => c.visibleWidthRatio >= 0.18 && c.visibleHeightRatio >= 0.18);
  const list = filtered.length ? filtered : arr;
  list.forEach(c => { c.finalScore = finalScore(c); });
  list.sort((a, b) => b.finalScore - a.finalScore);

  let best = list[0];
  for (let i = 1; i < Math.min(list.length, 8); i++) {
    const o = list[i];
    if (best.finalScore - o.finalScore > 0.2) break;
    if (best.element.contains(o.element)) {
      if (preferChild(o, best)) best = o;
    } else if (o.element.contains(best.element)) {
      if (!preferChild(best, o)) best = o;
    }
  }
  return (best.element as HTMLElement) || document.documentElement;
}

function preferChild(child: Cand, parent: Cand): boolean {
  return (child.pointHits >= parent.pointHits * 0.8 && child.visibleAreaRatio >= 0.16)
    || (parent.visibleWidthRatio > 0.94 && parent.visibleHeightRatio > 0.94 && child.pointHits > 0)
    || (child.semantic > parent.semantic + 0.18 && child.pointHits >= parent.pointHits * 0.6)
    || (child.directHits >= parent.directHits && child.visibleWidthRatio >= 0.35 && child.visibleHeightRatio >= 0.22);
}

function isInsideCode(el: Element): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (cur.tagName === 'PRE' || cur.tagName === 'CODE') return true;
    cur = cur.parentElement;
  }
  return false;
}

export function getAllElementsIncludingShadow(selector = ':not(script,noscript)', root: Element | ShadowRoot = document.body): Element[] {
  let acc: Element[] = Array.from(root.querySelectorAll(selector));
  acc.forEach(el => {
    if (el.shadowRoot) acc = acc.concat(getAllElementsIncludingShadow(selector, el.shadowRoot));
  });
  return acc;
}

export function getOffsetParent(el: Element): Element {
  let parent = el.parentElement;
  while (parent) {
    const pos = window.getComputedStyle(parent).position;
    if (pos === 'relative' || pos === 'absolute' || pos === 'fixed' || pos === 'sticky') return parent;
    parent = parent.parentElement;
  }
  return document.body;
}

export function openImageInNewTab(url: string) {
  const w = window.open(url, '_blank');
  if (!w) { URL.revokeObjectURL(url); return; }
  const cleanup = () => URL.revokeObjectURL(url);
  try {
    w.addEventListener('load', () => window.setTimeout(cleanup, 1000), { once: true });
  } catch {}
  window.setTimeout(cleanup, 60_000);
}
