import type { LyricsCache, LyricsProvider, LyricsQuery, LyricsResult } from "./types.js";

export interface LyricsServiceOptions {
  /** 按顺序尝试的歌词来源。 */
  providers: LyricsProvider[];
  /** 可选缓存。 */
  cache?: LyricsCache;
}

/** 生成稳定缓存 key：优先曲目 id，否则用 标题|艺人|时长(秒)。 */
export function cacheKeyOf(query: LyricsQuery): string {
  if (query.id) return `id:${query.id}`;
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
  return `q:${norm(query.title)}|${norm(query.artist)}|${Math.round(query.durationMs / 1000)}`;
}

/**
 * 歌词检索服务：缓存优先 → 依次尝试各来源 → 命中后写缓存。
 * 框架无关，Spicetify 与 Tauri 共用。
 */
export class LyricsService {
  private readonly providers: LyricsProvider[];
  private readonly cache?: LyricsCache;

  constructor(opts: LyricsServiceOptions) {
    this.providers = opts.providers;
    this.cache = opts.cache;
  }

  async getLyrics(query: LyricsQuery, opts?: { signal?: AbortSignal }): Promise<LyricsResult> {
    const key = cacheKeyOf(query);

    if (this.cache) {
      const hit = await this.cache.get(key);
      if (hit) return { status: "found", lyrics: hit };
    }

    let sawError = false;
    for (const provider of this.providers) {
      if (opts?.signal?.aborted) return { status: "error", message: "aborted" };
      const res = await provider.fetch(query, opts?.signal);
      if (res.status === "found") {
        if (this.cache) await this.cache.set(key, res.lyrics);
        return res;
      }
      if (res.status === "error") sawError = true;
    }

    return sawError ? { status: "error", message: "all providers failed" } : { status: "not-found" };
  }

  /** 清除某曲目的歌词缓存（强制重取用）。 */
  async evict(query: LyricsQuery): Promise<void> {
    if (this.cache) await this.cache.delete(cacheKeyOf(query));
  }
}
