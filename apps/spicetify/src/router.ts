/**
 * 路由式挂载，逻辑对齐参考插件 lucid-lyrics：
 * 通过 Spicetify.Platform.History 注册一个基路由；命中时把容器 <main> 挂进
 * 主视图（#main-view / .Root__main-view），隐藏同级兄弟节点（hideSiblings），
 * 离开路由时还原兄弟并移除容器。这样顶栏/侧栏/播放栏保持原样可用，
 * 与示例项目的窗口显示、挂载方式、位置完全一致。
 *
 * 启动竞态：若 Spotify 启动时就停在本路由，客户端 hydration 可能在我们挂载之后
 * 才重建 #main-view，导致容器被 detach、页面空白（需切走再回来才显示）。
 * 为此挂载后用 MutationObserver 持续盯住：仍在本路由但容器已脱离当前主视图时，
 * 把容器（连同其内 React 树）挂回新的主视图并重新隐藏兄弟——不重建 React root。
 */

interface HistoryLocation {
  pathname: string;
}
interface HistoryLike {
  location: HistoryLocation;
  listen(cb: (loc: HistoryLocation) => void): () => void;
  push(path: string): void;
  goBack(): void;
}

export interface RouteMount {
  /** 挂载到容器，返回清理函数。 */
  onMount: (el: HTMLElement) => (() => void) | void;
  hideSiblings?: boolean;
}

const MAIN_VIEW_SELECTOR = "#main-view, .Root__main-view";
const CONTAINER_ID = "ai-lyrics-page";
/** 永不隐藏的兄弟节点（队列/当前播放视图/侧栏等用户面板——藏了它们就"打不开"了）。 */
const PROTECTED_SIBLING = /queue|now-?playing|right-sidebar|buddy|sidebar|panel/i;
/** 挂载后仅此窗口内自动补隐藏新增兄弟（覆盖启动 hydration 竞态）；之后新增的不再动。 */
const REHIDE_WINDOW_MS = 5000;

function waitFor<T>(getter: () => T | undefined | null, timeoutMs = 15000): Promise<T | null> {
  const found = getter();
  if (found) return Promise.resolve(found);
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const v = getter();
      if (v || Date.now() - started > timeoutMs) {
        clearInterval(timer);
        resolve(v ?? null);
      }
    }, 100);
  });
}

function waitForElement(selector: string, timeoutMs = 15000): Promise<HTMLElement | null> {
  return waitFor(() => document.querySelector(selector) as HTMLElement | null, timeoutMs);
}

export class Router {
  private readonly base: string;
  private readonly route: RouteMount;
  private container: HTMLElement | null = null;
  private hidden: HTMLElement[] = [];
  private cleanup?: () => void;
  private currentPath: string | null = null;
  private transitionId = 0;
  private unlisten?: () => void;
  private mainViewObs?: MutationObserver;
  private reattachScheduled = false;
  private rehideUntil = 0;
  private readonly listeners = new Set<(active: boolean) => void>();

  constructor(base: string, route: RouteMount) {
    this.base = `/${base.replace(/^\/+|\/+$/g, "")}`;
    this.route = route;
  }

  private get history(): HistoryLike | undefined {
    return (window as unknown as { Spicetify?: { Platform?: { History?: HistoryLike } } }).Spicetify
      ?.Platform?.History;
  }

  async init(): Promise<void> {
    const history = await waitFor(() => this.history);
    if (!history) {
      console.error("[ai-lyrics] Spicetify History API 未找到");
      return;
    }
    this.unlisten = history.listen((loc) => this.handle(loc.pathname));
    this.handle(history.location.pathname);
  }

  isActive(): boolean {
    return this.currentPath === this.base;
  }

  /** 订阅激活态变化（用于播放栏按钮高亮）。 */
  onChange(cb: (active: boolean) => void): () => void {
    this.listeners.add(cb);
    cb(this.isActive());
    return () => this.listeners.delete(cb);
  }

  private emit() {
    const active = this.isActive();
    this.listeners.forEach((l) => l(active));
  }

  /** 在“进入/离开”之间切换（点击按钮调用）。 */
  toggle(): void {
    const h = this.history;
    if (!h) return;
    if (h.location.pathname === this.base) h.goBack();
    else h.push(this.base);
  }

  destroy(): void {
    this.unlisten?.();
    this.mainViewObs?.disconnect();
    this.mainViewObs = undefined;
    this.cleanup?.();
    this.restoreSiblings();
    this.container?.remove();
    this.container = null;
  }

  private async handle(rawPath: string): Promise<void> {
    const path = rawPath.length > 1 && rawPath.endsWith("/") ? rawPath.slice(0, -1) : rawPath || "/";
    // 容器已断开（启动竞态）时即便路径未变也要重挂，故附带 isConnected 校验。
    if (this.currentPath === path && this.container?.isConnected) return;

    const matched = path === this.base;

    if (!matched) {
      this.mainViewObs?.disconnect();
      this.mainViewObs = undefined;
      if (this.cleanup) {
        this.cleanup();
        this.cleanup = undefined;
      }
      this.restoreSiblings();
      this.container?.remove();
      this.container = null;
      this.currentPath = null;
      this.emit();
      return;
    }

    const tId = ++this.transitionId;
    const parent = await waitForElement(MAIN_VIEW_SELECTOR);
    if (tId !== this.transitionId) return;
    if (!parent) return;

    const firstMount = !this.container;
    this.attach(parent);

    if (firstMount) {
      try {
        this.cleanup = this.route.onMount(this.container!) || undefined;
      } catch (e) {
        console.error("[ai-lyrics] 页面挂载失败:", e);
      }
    }
    this.currentPath = path;
    this.startMainViewWatch();
    this.emit();
  }

  /** 创建/挂回容器并隐藏兄弟（幂等：主视图被重建时可重复调用，复用同一容器与 React 树）。 */
  private attach(parent: HTMLElement): void {
    this.restoreSiblings();
    if (!this.container) {
      const c = document.createElement("main");
      c.id = CONTAINER_ID;
      c.style.position = "relative";
      c.style.width = "100%";
      c.style.height = "100%";
      c.style.overflow = "hidden";
      this.container = c;
    }
    if (this.container.parentElement !== parent) parent.appendChild(this.container);
    if (this.route.hideSiblings) this.hideSiblings(parent, this.container);
    this.rehideUntil = Date.now() + REHIDE_WINDOW_MS;
  }

  /**
   * 监听 DOM：仍在本路由但容器脱离了当前主视图（启动时 Spotify 重建 #main-view 会导致），
   * 就把容器挂回新的主视图。用 microtask 合并同一批 mutation，避免高频回调。
   */
  private startMainViewWatch(): void {
    this.mainViewObs?.disconnect();
    const obs = new MutationObserver(() => {
      if (this.reattachScheduled) return;
      this.reattachScheduled = true;
      queueMicrotask(() => {
        this.reattachScheduled = false;
        if (!this.isActive() || !this.container) return;
        const parent = document.querySelector(MAIN_VIEW_SELECTOR) as HTMLElement | null;
        if (!parent) return;
        if (this.container.parentElement !== parent) {
          this.attach(parent); // 主视图被重建：整体挂回 + 重隐藏兄弟
        } else if (this.route.hideSiblings && Date.now() < this.rehideUntil) {
          // 仅挂载后短窗口内补隐藏（启动 hydration 竞态）；之后新增的兄弟
          // （如用户打开的队列/当前播放视图）不再隐藏，否则它们永远"打不开"。
          this.hideSiblings(parent, this.container);
        }
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });
    this.mainViewObs = obs;
  }

  private hideSiblings(parent: HTMLElement, current: HTMLElement) {
    const children = parent.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i] as HTMLElement;
      if (child === current) continue;
      if (child.dataset.ailHidden !== undefined) continue; // 已隐藏并记录，幂等跳过
      // 队列/当前播放视图/侧栏等用户面板：永不隐藏（藏了用户就打不开它们了）。
      const ident = `${String(child.className ?? "")} ${child.id ?? ""} ${child.tagName}`;
      if (PROTECTED_SIBLING.test(ident) || child.tagName === "ASIDE") continue;
      child.dataset.ailHidden = child.style.display;
      child.style.display = "none";
      this.hidden.push(child);
    }
  }

  private restoreSiblings() {
    let el: HTMLElement | undefined;
    while ((el = this.hidden.pop())) {
      el.style.display = el.dataset.ailHidden || "";
      delete el.dataset.ailHidden;
    }
  }
}
