import type { LyricLine, Lyrics, LyricsProvider, LyricsQuery, LyricsResult } from "@ai-lyrics/lyrics-core";

/**
 * Spotify 自带歌词（Musixmatch 提供，按 track id 精确匹配，质量高）。
 * 仅在 Spicetify 中可用：通过 CosmosAsync 走内部鉴权接口，无 CORS 问题。
 * 失败/无歌词时返回 not-found，交由后续 LRCLIB 兜底。宿主特定，不进 lyrics-core。
 */
export function createSpotifyLyricsProvider(): LyricsProvider {
  return {
    id: "spotify-color-lyrics",
    async fetch(query: LyricsQuery): Promise<LyricsResult> {
      const id = query.id;
      const cosmos = Spicetify?.CosmosAsync;
      if (!id || !cosmos) return { status: "not-found" };

      try {
        const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${id}?format=json&vocalRemoval=false&market=from_token`;
        const body = await cosmos.get(url);
        const lyrics = body?.lyrics;
        const rawLines: any[] = lyrics?.lines;
        if (!lyrics || !Array.isArray(rawLines) || rawLines.length === 0) {
          return { status: "not-found" };
        }

        if (lyrics.syncType === "LINE_SYNCED") {
          const lines: LyricLine[] = rawLines.map((l) => ({
            timeMs: Number(l.startTimeMs) || 0,
            text: l.words === "♪" ? "" : String(l.words ?? ""),
          }));
          const out: Lyrics = { synced: true, lines, provider: "spotify" };
          return { status: "found", lyrics: out };
        }

        const lines = rawLines.map((l) => String(l.words ?? ""));
        const out: Lyrics = { synced: false, lines, provider: "spotify" };
        return { status: "found", lyrics: out };
      } catch {
        // 401/404/网络等：当作没有，交给 LRCLIB。
        return { status: "not-found" };
      }
    },
  };
}
