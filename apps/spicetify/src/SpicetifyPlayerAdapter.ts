import type { PlayerAdapter, Track, Unsubscribe } from "@ai-lyrics/player-core";

/**
 * 返回封面图源的原始值（不转换）。
 * Kawarp 背景与 lucid 一致：`spotify:image:…` 用 crossOrigin=null 交由客户端解析，
 * https 用 anonymous。保留原始 URI 比强转 https 更可靠（避免 WebGL 跨域污染）。
 */
function toImageUrl(raw?: string): string | undefined {
  return raw || undefined;
}

/** `spotify:track:<id>` → `<id>`。 */
function parseId(uri?: string): string {
  if (!uri) return "";
  const i = uri.lastIndexOf(":");
  return i >= 0 ? uri.slice(i + 1) : uri;
}

function readTrack(): Track | null {
  const item = Spicetify?.Player?.data?.item;
  if (!item) return null;
  const m = (item.metadata ?? {}) as Record<string, string>;

  const artists: string[] = [];
  if (m.artist_name) artists.push(m.artist_name);
  for (let i = 1; m[`artist_name:${i}`]; i++) artists.push(m[`artist_name:${i}`]);

  const duration = Spicetify.Player.getDuration?.() || Number(m.duration) || 0;

  return {
    id: parseId(item.uri),
    title: m.title ?? item.name ?? "",
    artists,
    album: m.album_title || undefined,
    durationMs: duration,
    coverUrl: toImageUrl(m.image_xlarge_url || m.image_large_url || m.image_url || m.image_small_url),
  };
}

/** 基于 Spicetify.Player 的 PlayerAdapter 实现。 */
export class SpicetifyPlayerAdapter implements PlayerAdapter {
  getTrack(): Track | null {
    return readTrack();
  }

  getProgressMs(): number {
    return Spicetify?.Player?.getProgress?.() ?? 0;
  }

  isPlaying(): boolean {
    return Spicetify?.Player?.isPlaying?.() ?? false;
  }

  seek(ms: number): void {
    try {
      Spicetify.Player.seek(ms);
    } catch {
      /* ignore */
    }
  }

  togglePlay(): void {
    try {
      Spicetify.Player.togglePlay();
    } catch {
      /* ignore */
    }
  }

  onSongChange(cb: (track: Track | null) => void): Unsubscribe {
    const h = () => cb(readTrack());
    Spicetify.Player.addEventListener("songchange", h);
    return () => Spicetify.Player.removeEventListener("songchange", h);
  }

  onProgress(cb: (ms: number) => void): Unsubscribe {
    const h = (e: { data?: unknown }) =>
      cb(typeof e?.data === "number" ? e.data : Spicetify.Player.getProgress());
    Spicetify.Player.addEventListener("onprogress", h);
    return () => Spicetify.Player.removeEventListener("onprogress", h);
  }

  onPlayPause(cb: (playing: boolean) => void): Unsubscribe {
    const h = () => cb(Spicetify.Player.isPlaying());
    Spicetify.Player.addEventListener("onplaypause", h);
    return () => Spicetify.Player.removeEventListener("onplaypause", h);
  }
}
