/**
 * 运行时测量本页容器与 Spotify 顶栏 / 底部播放栏的重叠量，
 * 写入 CSS 变量 --ail-top / --ail-bottom，供 .ail-root 作为安全内边距。
 *
 * 为什么需要：不同 Spotify 版本里，主视图区域可能被半透明顶栏覆盖、
 * 或我们的页面铺满整窗，导致顶部/底部内容被遮挡。直接量重叠最稳，
 * 无重叠时内边距为 0（不会过度留白）。属宿主特定布局逻辑，不进可移植 UI 包。
 */

const TOP_SELECTORS = [
  ".Root__globalNav",
  ".Root__top-bar",
  ".main-topBar-container",
  "[data-testid='topbar']",
];
const BOTTOM_SELECTORS = [
  ".Root__now-playing-bar",
  "[data-testid='now-playing-bar']",
  ".main-nowPlayingBar-container",
];

function firstRect(selectors: string[]): DOMRect | null {
  for (const s of selectors) {
    const el = document.querySelector(s);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.height > 0) return r;
    }
  }
  return null;
}

/** 开始跟踪并应用内边距；返回停止函数。 */
export function trackMainViewInsets(container: HTMLElement): () => void {
  const update = () => {
    const c = container.getBoundingClientRect();
    if (c.height === 0) return;
    const top = firstRect(TOP_SELECTORS);
    const bottom = firstRect(BOTTOM_SELECTORS);
    const topOverlap = top ? clamp(Math.round(top.bottom - c.top), 0, 200) : 0;
    const bottomOverlap = bottom ? clamp(Math.round(c.bottom - bottom.top), 0, 260) : 0;
    container.style.setProperty("--ail-top", `${topOverlap}px`);
    container.style.setProperty("--ail-bottom", `${bottomOverlap}px`);
  };

  update();
  // 布局/动画稳定后再量两次。
  const t1 = window.setTimeout(update, 150);
  const t2 = window.setTimeout(update, 600);
  window.addEventListener("resize", update);
  const ro = new ResizeObserver(update);
  ro.observe(container);
  ro.observe(document.body);

  return () => {
    window.clearTimeout(t1);
    window.clearTimeout(t2);
    window.removeEventListener("resize", update);
    ro.disconnect();
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
