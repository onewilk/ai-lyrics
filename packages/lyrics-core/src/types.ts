/** 一行带时间戳的歌词。 */
export interface LyricLine {
  /** 行起始时间（毫秒）。 */
  timeMs: number;
  text: string;
}

/** 时间同步歌词。 */
export interface SyncedLyrics {
  synced: true;
  lines: LyricLine[];
  provider: string;
}

/** 无时间轴的纯文本歌词。 */
export interface PlainLyrics {
  synced: false;
  lines: string[];
  provider: string;
}

export type Lyrics = SyncedLyrics | PlainLyrics;

/** 歌词检索条件。 */
export interface LyricsQuery {
  title: string;
  artist: string;
  album?: string;
  durationMs: number;
  /**
   * 宿主侧的曲目标识（如 Spotify track id）。LRCLIB 不使用；
   * 像 Spotify color-lyrics 这类按 id 检索的来源会用到。同时作为缓存 key。
   */
  id?: string;
}

export type LyricsResult =
  | { status: "found"; lyrics: Lyrics }
  | { status: "not-found" }
  | { status: "error"; message: string };

/** 歌词来源。可注册多个，按顺序回退。 */
export interface LyricsProvider {
  readonly id: string;
  fetch(query: LyricsQuery, signal?: AbortSignal): Promise<LyricsResult>;
}

/** 歌词缓存（异步，便于 localStorage / IndexedDB / 文件多实现）。 */
export interface LyricsCache {
  get(key: string): Promise<Lyrics | null>;
  set(key: string, value: Lyrics): Promise<void>;
  delete(key: string): Promise<void>;
}
