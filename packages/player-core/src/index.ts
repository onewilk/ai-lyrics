/**
 * player-core — 框架无关的播放器抽象。
 *
 * 这是整个项目复用的关键边界：UI 与歌词/AI 逻辑只依赖本接口，不直接碰
 * 任何宿主（Spicetify / Tauri）。Spicetify 阶段提供 SpicetifyPlayerAdapter，
 * 后续 Mac App 阶段只需新增一个 TauriPlayerAdapter。
 */

/** 当前曲目的归一化元数据。 */
export interface Track {
  /** 稳定的曲目标识（如 Spotify 的 track id；用于歌词缓存 key）。 */
  id: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs: number;
  /** 封面图 URL（尽量取高清）。 */
  coverUrl?: string;
}

export type Unsubscribe = () => void;

/**
 * 播放器适配层接口。各宿主实现之，向上提供统一能力。
 *
 * 约定：
 * - 进度单位统一为毫秒。
 * - seek 入参为毫秒（绝对位置）。
 * - on* 订阅返回取消订阅函数。
 */
export interface PlayerAdapter {
  /** 当前曲目；无歌曲时为 null。 */
  getTrack(): Track | null;
  /** 当前播放进度（毫秒）。 */
  getProgressMs(): number;
  /** 是否正在播放。 */
  isPlaying(): boolean;
  /** 跳转到绝对位置（毫秒）。 */
  seek(ms: number): void;
  /** 播放/暂停切换（UI 可选用）。 */
  togglePlay?(): void;

  /** 曲目切换（含从有到无）。 */
  onSongChange(cb: (track: Track | null) => void): Unsubscribe;
  /** 进度更新。高频，UI 侧自行节流。 */
  onProgress(cb: (ms: number) => void): Unsubscribe;
  /** 播放/暂停状态变化。 */
  onPlayPause?(cb: (playing: boolean) => void): Unsubscribe;
}

/** 便捷工具：把 Track 归一成用于歌词检索/缓存的简单结构。 */
export function trackPrimaryArtist(track: Track): string {
  return track.artists[0] ?? "";
}
