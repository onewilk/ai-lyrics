import type { LyricLine } from "./types.js";

/** 匹配行首/行内的 [mm:ss] / [mm:ss.xx] / [mm:ss.xxx] 时间标签。 */
const TIME_TAG = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
/** 行内逐字时间标签（卡拉OK），渲染时按行展示，先剥离。 */
const INLINE_WORD_TAG = /<\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?>/g;

/**
 * 解析标准 LRC 文本为按时间升序的歌词行。
 *
 * - 支持一行多个时间戳（`[00:01.00][00:05.00] text`）。
 * - 跳过元数据标签行（`[ar:..]` `[ti:..]` `[offset:..]` 等，不含数字冒号时间）。
 * - 剥离行内逐字时间标签与残留 XML 标签。
 * - 间奏/空行（`♪`/空文本）保留为空字符串行，交给 UI 决定如何展示。
 */
export function parseLrc(raw: string): LyricLine[] {
  const out: LyricLine[] = [];
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    TIME_TAG.lastIndex = 0;
    const stamps: number[] = [];
    let lastMatchEnd = 0;
    let m: RegExpExecArray | null;
    while ((m = TIME_TAG.exec(line)) !== null) {
      // 只接受出现在行首连续位置的时间标签（避免把行内逐字标签当成行时间）。
      if (m.index !== lastMatchEnd) break;
      const min = Number(m[1]);
      const secRaw = m[2].replace(":", ".");
      const sec = Number(secRaw);
      if (!Number.isNaN(min) && !Number.isNaN(sec)) {
        stamps.push(Math.round((min * 60 + sec) * 1000));
      }
      lastMatchEnd = m.index + m[0].length;
    }

    if (stamps.length === 0) continue; // 元数据行或无时间行

    let text = line.slice(lastMatchEnd).replace(INLINE_WORD_TAG, "").replace(/<[^>]+>/g, "").trim();
    if (text === "♪" || text === "♫") text = "";

    for (const timeMs of stamps) out.push({ timeMs, text });
  }

  out.sort((a, b) => a.timeMs - b.timeMs);
  return out;
}
