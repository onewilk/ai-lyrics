import {
  LrclibProvider,
  LyricsService,
  createLocalStorageCache,
  lyricsMatchTarget,
  type LyricsProvider,
} from "@ai-lyrics/lyrics-core";
import {
  AiService,
  createAiProvider,
  createLocalStorageAnalysisCache,
  defaultAiSettings,
  type AiSettings,
} from "@ai-lyrics/ai-core";
import type { PlayerAdapter, Track } from "@ai-lyrics/player-core";

interface PrefetchDeps {
  extraProviders?: LyricsProvider[];
  userAgent?: string;
  directFetch?: typeof fetch;
  proxyFetch?: typeof fetch;
  storageKey: string;
  /** 面板是否打开（开着时当前歌由面板负责，预取跳过当前、只预取后续）。 */
  isPanelActive: () => boolean;
}

function normModels(src: { models?: unknown; model?: unknown } | undefined, fb: string[]): string[] {
  const arr = Array.isArray(src?.models)
    ? (src!.models as unknown[]).filter((m): m is string => typeof m === "string" && !!m.trim())
    : typeof src?.model === "string" && src.model.trim()
      ? [src.model]
      : [];
  return arr.length ? arr.slice(0, 3) : fb;
}

function readSettings(key: string): AiSettings {
  try {
    const p = JSON.parse(localStorage.getItem(key) ?? "{}") as Partial<AiSettings> & {
      ollama?: { baseUrl?: string; model?: string; models?: string[] };
      openai?: { baseUrl?: string; apiKey?: string; model?: string; models?: string[] };
    };
    return {
      ...defaultAiSettings,
      ...p,
      ollama: {
        baseUrl: p.ollama?.baseUrl ?? defaultAiSettings.ollama.baseUrl,
        models: normModels(p.ollama, defaultAiSettings.ollama.models),
      },
      openai: {
        baseUrl: p.openai?.baseUrl ?? defaultAiSettings.openai.baseUrl,
        apiKey: p.openai?.apiKey ?? "",
        models: normModels(p.openai, defaultAiSettings.openai.models),
      },
    } as AiSettings;
  } catch {
    return defaultAiSettings;
  }
}

function mapQueueTrack(qt: any): Track | null {
  const item = qt?.contextTrack ?? qt;
  const m = (item?.metadata ?? {}) as Record<string, string>;
  const uri: string = item?.uri ?? "";
  if (!m.title) return null;
  const id = uri.includes(":") ? uri.slice(uri.lastIndexOf(":") + 1) : uri;
  const artists: string[] = [];
  if (m.artist_name) artists.push(m.artist_name);
  return { id, title: m.title, artists, album: m.album_title || undefined, durationMs: Number(m.duration) || 0 };
}

function getUpcoming(n: number): Track[] {
  if (n <= 0) return [];
  const sp = (window as unknown as { Spicetify?: any }).Spicetify;
  const q: any[] = sp?.Queue?.nextTracks ?? sp?.Player?.data?.nextTracks ?? [];
  const out: Track[] = [];
  for (const qt of q) {
    const t = mapQueueTrack(qt);
    if (t) out.push(t);
    if (out.length >= n) break;
  }
  return out;
}

/** 启动后台预取：按设置预解析当前 + 队列后续歌曲，结果写入共享持久缓存。 */
export function startPrefetch(player: PlayerAdapter, deps: PrefetchDeps): void {
  const lyricsService = new LyricsService({
    providers: [...(deps.extraProviders ?? []), new LrclibProvider({ userAgent: deps.userAgent })],
    cache: createLocalStorageCache(),
  });
  const analysisCache = createLocalStorageAnalysisCache();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ctrl: AbortController | undefined;

  const prefetchTrack = async (t: Track, s: AiSettings, signal: AbortSignal) => {
    const lyr = await lyricsService.getLyrics(
      { title: t.title, artist: t.artists[0] ?? "", album: t.album, durationMs: t.durationMs, id: t.id },
      { signal },
    );
    if (lyr.status !== "found") return;
    // 带时间轴用 LyricLine.text；纯文本本就是字符串数组。两者都预解析。
    const lines = lyr.lyrics.synced ? lyr.lyrics.lines.map((l) => l.text) : lyr.lyrics.lines;
    if (lyricsMatchTarget(lines, s.targetLang)) return; // 歌词语言==目标语言：无需翻译，跳过
    const provider = createAiProvider(s, { fetchImpl: s.useCorsProxy ? deps.proxyFetch : deps.directFetch });
    if (!provider) return;
    const ai = new AiService(provider, s.targetLang, analysisCache);
    const isLocalAi = /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)([:/]|$)/i.test(
      s.provider === "ollama" ? s.ollama.baseUrl : s.openai.baseUrl,
    );
    await ai.analyzeAll(
      lines,
      { trackTitle: t.title, artist: t.artists[0], songId: t.id },
      { onUpdate: () => {}, signal, chunkSize: s.chunkSize, serial: isLocalAi }, // 预取与主路径同构
    );
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    // 稍等再跑，避免与面板解析/快速切歌竞争。
    timer = setTimeout(() => {
      const s = readSettings(deps.storageKey);
      if (!s.prefetch) return;
      ctrl?.abort();
      ctrl = new AbortController();
      const signal = ctrl.signal;
      const current = player.getTrack();
      const targets: Track[] = [];
      if (current && !deps.isPanelActive()) targets.push(current);
      targets.push(...getUpcoming(Math.max(0, s.prefetchCount - 1)));

      void (async () => {
        for (const t of targets) {
          if (signal.aborted) return;
          try {
            await prefetchTrack(t, s, signal);
          } catch {
            /* 预取失败静默 */
          }
        }
      })();
    }, 2500);
  };

  player.onSongChange(schedule);
  schedule();
}
