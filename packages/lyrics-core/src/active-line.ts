import type { LyricLine } from "./types.js";

/**
 * 给定进度（毫秒），返回当前应高亮的歌词行下标。
 * - 返回最后一个 timeMs <= progressMs 的行；
 * - 若进度早于第一行，返回 -1。
 * 二分查找，供左栏滚动高亮与右栏定位共用。
 */
export function getActiveLineIndex(lines: LyricLine[], progressMs: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs <= progressMs) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}
