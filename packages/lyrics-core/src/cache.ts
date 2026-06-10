import type { Lyrics, LyricsCache } from "./types.js";

interface Stored {
  v: 1;
  at: number;
  lyrics: Lyrics;
}

/** 进程内存缓存。 */
export function createMemoryCache(): LyricsCache {
  const map = new Map<string, Lyrics>();
  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
  };
}

/**
 * localStorage 缓存（浏览器 / Spicetify / Tauri webview 通用）。
 * 带 TTL；环境无 localStorage 时静默降级为空操作。
 */
export function createLocalStorageCache(opts?: { prefix?: string; ttlMs?: number }): LyricsCache {
  const prefix = opts?.prefix ?? "ai-lyrics:lrc:";
  const ttlMs = opts?.ttlMs ?? 30 * 24 * 60 * 60 * 1000; // 30 天
  const ls: Storage | null = typeof localStorage !== "undefined" ? localStorage : null;

  return {
    async get(key) {
      if (!ls) return null;
      const raw = ls.getItem(prefix + key);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as Stored;
        if (Date.now() - parsed.at > ttlMs) {
          ls.removeItem(prefix + key);
          return null;
        }
        return parsed.lyrics;
      } catch {
        ls.removeItem(prefix + key);
        return null;
      }
    },
    async set(key, value) {
      if (!ls) return;
      const stored: Stored = { v: 1, at: Date.now(), lyrics: value };
      try {
        ls.setItem(prefix + key, JSON.stringify(stored));
      } catch {
        // 配额满等：忽略。
      }
    },
    async delete(key) {
      ls?.removeItem(prefix + key);
    },
  };
}
