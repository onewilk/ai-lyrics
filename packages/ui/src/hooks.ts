import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerAdapter, Track } from "@ai-lyrics/player-core";
import type { Lyrics, LyricsService } from "@ai-lyrics/lyrics-core";
import type { AiService, LineAnalysis } from "@ai-lyrics/ai-core";

/** 订阅播放器状态：当前曲目、进度（节流）、播放与否。 */
export function usePlayerState(player: PlayerAdapter, progressThrottleMs = 100) {
  const [track, setTrack] = useState<Track | null>(() => player.getTrack());
  const [progressMs, setProgressMs] = useState(() => player.getProgressMs());
  const [playing, setPlaying] = useState(() => player.isPlaying());
  const lastProgressAt = useRef(0);

  useEffect(() => {
    setTrack(player.getTrack());
    setProgressMs(player.getProgressMs());
    setPlaying(player.isPlaying());

    const offSong = player.onSongChange((t) => {
      setTrack(t);
      setProgressMs(player.getProgressMs());
    });
    const offProgress = player.onProgress((ms) => {
      const now = Date.now();
      if (now - lastProgressAt.current >= progressThrottleMs) {
        lastProgressAt.current = now;
        setProgressMs(ms);
      }
    });
    const offPlay = player.onPlayPause?.(setPlaying) ?? (() => {});

    // 兜底：重载后页面可能在 Player.data 就绪前就挂载，getTrack() 返回 null，
    // 而正在播放的曲目不会再触发 songchange，于是会一直卡在"暂无播放"。
    // 这里在曲目为空时轮询，直到出现为止（或超时）。
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    if (!player.getTrack()) {
      let tries = 0;
      pollTimer = setInterval(() => {
        tries += 1;
        const t = player.getTrack();
        if (t) {
          setTrack(t);
          setProgressMs(player.getProgressMs());
          setPlaying(player.isPlaying());
        }
        if (t || tries > 40) {
          clearInterval(pollTimer);
          pollTimer = undefined;
        }
      }, 300);
    }

    return () => {
      offSong();
      offProgress();
      offPlay();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [player, progressThrottleMs]);

  return { track, progressMs, playing };
}

export type LyricsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "found"; lyrics: Lyrics }
  | { status: "not-found" }
  | { status: "error"; message: string };

/** 曲目变化时抓取歌词（带取消）。refreshKey 变化会强制重取。 */
export function useLyrics(service: LyricsService, track: Track | null, refreshKey = 0): LyricsState {
  const [state, setState] = useState<LyricsState>({ status: "idle" });

  useEffect(() => {
    if (!track) {
      setState({ status: "idle" });
      return;
    }
    const ctrl = new AbortController();
    setState({ status: "loading" });
    service
      .getLyrics(
        {
          title: track.title,
          artist: track.artists[0] ?? track.artists.join(", "),
          album: track.album,
          durationMs: track.durationMs,
          id: track.id,
        },
        { signal: ctrl.signal },
      )
      .then((res) => {
        if (ctrl.signal.aborted) return;
        if (res.status === "found") setState({ status: "found", lyrics: res.lyrics });
        else if (res.status === "not-found") setState({ status: "not-found" });
        else setState({ status: "error", message: res.message });
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setState({ status: "error", message: String(e?.message ?? e) });
      });
    return () => ctrl.abort();
    // 仅在曲目 id / 刷新键变化时重取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, track?.id, refreshKey]);

  return state;
}

export interface AllAnalysesState {
  /** AI 是否已配置可用。 */
  ready: boolean;
  /** 与歌词行一一对应；null 表示尚未解析。 */
  byIndex: (LineAnalysis | null)[];
  /** 是否仍有分块在请求中。 */
  loading: boolean;
  error?: string;
}

/**
 * 解析整首歌的所有行：缓存优先，未命中的连续片段分块进度式请求。
 * 返回与行数等长的结果数组，随各分块返回逐步填充。
 */
export function useAllAnalyses(
  ai: AiService,
  lines: string[],
  ctx: { trackTitle?: string; artist?: string; songId?: string },
  refreshKey = 0,
  priorityIndex = -1,
  /** 分块大小（由用户设置传入，默认 22）。 */
  chunkSize = 22,
  /** 串行派发分块（本地单模型端点用，避免并发互抢算力）。 */
  serial = false,
): AllAnalysesState {
  const linesKey = useMemo(() => lines.join(""), [lines]);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  // 优先行通过 ref 读取（不作为依赖，避免每次换行都重跑整首解析）。
  const priorityRef = useRef(priorityIndex);
  priorityRef.current = priorityIndex;

  const [state, setState] = useState<AllAnalysesState>({
    ready: ai.isReady(),
    byIndex: [],
    loading: false,
  });

  useEffect(() => {
    if (!ai.isReady()) {
      setState({ ready: false, byIndex: lines.map(() => null), loading: false });
      return;
    }
    if (lines.length === 0) {
      setState({ ready: true, byIndex: [], loading: false });
      return;
    }

    setState({ ready: true, byIndex: new Array(lines.length).fill(null), loading: true });
    const ctrl = new AbortController();

    ai.analyzeAll(lines, ctxRef.current, {
      signal: ctrl.signal,
      priorityIndex: priorityRef.current,
      chunkSize,
      serial,
      onUpdate: (i, analysis) => {
        if (ctrl.signal.aborted) return;
        setState((prev) => {
          const byIndex = prev.byIndex.slice();
          byIndex[i] = analysis;
          return { ...prev, byIndex };
        });
      },
      onError: (err) => {
        if (!ctrl.signal.aborted) setState((prev) => ({ ...prev, error: err.message }));
      },
    })
      .then(() => {
        if (!ctrl.signal.aborted) setState((prev) => ({ ...prev, loading: false }));
      })
      .catch((e) => {
        if (!ctrl.signal.aborted)
          setState((prev) => ({ ...prev, loading: false, error: String(e?.message ?? e) }));
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, linesKey, refreshKey]);

  return state;
}
