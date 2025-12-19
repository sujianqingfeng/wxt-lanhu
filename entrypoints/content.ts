export default defineContentScript({
  matches: ['*://lanhuapp.com/web/*'],
  main() {
    // 在蓝湖右侧资源抽屉里，为 Web @1x / Web @2x 增加「Copy」按钮，复制图片 URL。

    const STYLE_ID = 'lanhu-copy-url-style';
    const BTN_CLASS = 'lanhu-copy-url-btn';

    injectStyleOnce();
    enhanceAll();

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        enhanceAll();
      });
    });
    observer.observe(document.documentElement, { subtree: true, childList: true });

    function enhanceAll() {
      const drawers = document.querySelectorAll<HTMLElement>('.info-drawer');
      for (const drawer of drawers) enhanceDrawer(drawer);
    }

    function enhanceDrawer(drawer: HTMLElement) {
      const downList = drawer.querySelector<HTMLElement>('.down_list');
      if (!downList) return;

      const rows = downList.querySelectorAll<HTMLLIElement>('li.list_li');
      if (!rows.length) return;

      for (const row of rows) {
        const labelEl = row.querySelector<HTMLElement>('.mu-checkbox-label');
        const labelText = (labelEl?.textContent ?? '').trim();

        // 目前仅处理 Web @1x / Web @2x
        if (!/Web\s*@\s*[12]x/i.test(labelText)) continue;

        if (row.querySelector(`.${BTN_CLASS}`)) continue;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = BTN_CLASS;
        btn.textContent = 'Copy';

        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const sizeText = getRowSizeText(row);
          const size = sizeText ? parsePxSize(sizeText) : null;

          const baseUrl =
            findUrlNearRow(row) ??
            findBestUrlInDrawer(drawer) ??
            findRecentLanhuImageUrl();

          if (!baseUrl) {
            flash(btn, 'No URL');
            return;
          }

          const finalUrl = size ? buildOssResizeUrl(baseUrl, size.width, size.height) : baseUrl;
          const ok = await copyText(finalUrl);
          flash(btn, ok ? 'Copied' : 'Failed');
        });

        row.appendChild(btn);
      }
    }

    function injectStyleOnce() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        .${BTN_CLASS}{
          margin-left: 8px;
          padding: 2px 8px;
          height: 24px;
          line-height: 20px;
          font-size: 12px;
          border-radius: 4px;
          border: 1px solid rgba(0,0,0,.18);
          background: #fff;
          color: #333;
          cursor: pointer;
          user-select: none;
        }
        .${BTN_CLASS}:hover{ background: rgba(0,0,0,.03); }
        .${BTN_CLASS}:active{ transform: translateY(1px); }
      `;
      document.head.appendChild(style);
    }
  },
});

function getRowSizeText(row: HTMLElement): string | null {
  const spans = row.querySelectorAll('span');
  for (const s of spans) {
    const t = (s.textContent ?? '').trim();
    if (!t) continue;
    if (/\d+\s*px\s*x\s*\d+\s*px/i.test(t)) return t;
  }
  return null;
}

function parsePxSize(text: string): { width: number; height: number } | null {
  const m = text.match(/(\d+)\s*px\s*x\s*(\d+)\s*px/i);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function isProbablyImageUrl(url: string): boolean {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  try {
    const u = new URL(url);
    const p = u.pathname.toLowerCase();
    return (
      p.endsWith('.png') ||
      p.endsWith('.jpg') ||
      p.endsWith('.jpeg') ||
      p.endsWith('.webp') ||
      p.endsWith('.gif') ||
      p.endsWith('.svg')
    );
  } catch {
    return false;
  }
}

function buildOssResizeUrl(baseUrl: string, width: number, height: number): string {
  try {
    const u = new URL(baseUrl);
    const process = `image/resize,m_fixed,w_${Math.round(width)},h_${Math.round(height)}`;
    u.searchParams.set('x-oss-process', process);
    return u.toString();
  } catch {
    return baseUrl;
  }
}

function findBestUrlInDrawer(drawer: HTMLElement): string | null {
  const imgs = drawer.querySelectorAll<HTMLImageElement>('img[src]');
  for (const img of imgs) {
    const src = (img.getAttribute('src') ?? '').trim();
    if (isProbablyImageUrl(src)) return src;
  }

  const vm = findNearestVueInstance(drawer);
  if (vm) {
    const urls = collectUrls(vm, 2);
    const picked = pickBestImageUrl(urls);
    if (picked) return picked;
  }
  return null;
}

function findUrlNearRow(row: HTMLElement): string | null {
  const a = row.querySelector<HTMLAnchorElement>('a[href]');
  const href = (a?.getAttribute('href') ?? '').trim();
  if (isProbablyImageUrl(href)) return href;

  const img = row.querySelector<HTMLImageElement>('img[src]');
  const src = (img?.getAttribute('src') ?? '').trim();
  if (isProbablyImageUrl(src)) return src;

  const attrs = ['data-url', 'data-src', 'data-href', 'data-download', 'data-clipboard-text'];
  for (const attr of attrs) {
    const v = (row.getAttribute(attr) ?? '').trim();
    if (isProbablyImageUrl(v)) return v;
  }

  const vm = findNearestVueInstance(row);
  if (vm) {
    const urls = collectUrls(vm, 2);
    const picked = pickBestImageUrl(urls);
    if (picked) return picked;
  }

  return null;
}

function findNearestVueInstance(start: Element): any | null {
  let el: Element | null = start;
  for (let i = 0; i < 8 && el; i++) {
    const anyEl = el as any;
    if (anyEl.__vue__) return anyEl.__vue__;
    el = el.parentElement;
  }
  return null;
}

function collectUrls(root: unknown, maxDepth: number): string[] {
  const urls = new Set<string>();
  const seen = new Set<unknown>();

  function visit(value: unknown, depth: number) {
    if (value == null) return;
    if (typeof value === 'string') {
      if (value.startsWith('http://') || value.startsWith('https://')) urls.add(value);
      return;
    }
    if (typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    if (depth <= 0) return;

    if (Array.isArray(value)) {
      for (const v of value) visit(v, depth - 1);
      return;
    }
    const obj = value as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      if (k === '$el' || k === 'el' || k === 'parent' || k === 'children' || k === '_watchers') continue;
      visit(obj[k], depth - 1);
    }
  }

  visit(root, maxDepth);
  return Array.from(urls);
}

function pickBestImageUrl(urls: string[]): string | null {
  const candidates = urls.filter(isProbablyImageUrl);
  if (!candidates.length) return null;
  const scored = candidates
    .map((url) => ({ url, score: scoreUrl(url) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.url ?? null;
}

function scoreUrl(url: string): number {
  let score = 0;
  if (/FigmaSlice/i.test(url)) score += 50;
  if (/lanhu-oss/i.test(url)) score += 20;
  if (/alipic\.lanhuapp\.com/i.test(url)) score += 10;
  if (/\.(png|svg)$/i.test(url)) score += 5;
  // 排除明显无关的下载页
  if (/lanhuapp\.com\/(mac|ps|xd)/i.test(url)) score -= 100;
  return score;
}

function findRecentLanhuImageUrl(): string | null {
  try {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    for (let i = entries.length - 1; i >= 0 && i >= entries.length - 80; i--) {
      const e = entries[i];
      const url = (e as any).name as string | undefined;
      if (!url) continue;
      if (!isProbablyImageUrl(url)) continue;
      if (/lanhu/i.test(url)) return url;
    }
  } catch {
    // ignore
  }
  return null;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function flash(btn: HTMLButtonElement, text: string) {
  const prev = btn.textContent ?? '';
  btn.textContent = text;
  btn.disabled = true;
  window.setTimeout(() => {
    btn.textContent = prev || 'Copy';
    btn.disabled = false;
  }, 900);
}
