// 汉字（CJK 统一表意文字，含扩展 A 与兼容区）——中日韩共用，单凭它无法区分语言。
const HAN = /[㐀-䶿一-鿿豈-﫿]/;
// 假名（仅取真正的音节字母，排除「・」「ー」等标点/长音记号，避免误判）：平假名 + 片假名。
const KANA = /[ぁ-ゖァ-ヺ]/;
// 谚文（韩文）音节 + 字母。
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;
const LATIN = /[a-zA-Z]/;

/** 粗粒度语言码（按字符脚本判定；拉丁系无法细分语种，统归 en）。 */
export type LangCode = "zh" | "ja" | "ko" | "en" | "other";

/** 检测歌词主要语言（基于脚本：汉字/假名/谚文/拉丁）。 */
export function detectLang(lines: string[]): LangCode {
  let han = 0;
  let kana = 0;
  let hangul = 0;
  let latin = 0;
  for (const line of lines) {
    for (const ch of line) {
      if (KANA.test(ch)) kana++;
      else if (HANGUL.test(ch)) hangul++;
      else if (HAN.test(ch)) han++;
      else if (LATIN.test(ch)) latin++;
    }
  }
  if (kana > 0 && kana / (han + kana) >= 0.05) return "ja";
  if (hangul > 0 && hangul / (hangul + han + latin) >= 0.1) return "ko";
  if (han > 0 && han / (han + latin || 1) >= 0.5) return "zh";
  if (latin > 0 && latin / (latin + han + kana + hangul || 1) >= 0.5) return "en";
  return "other";
}

/** 把用户填的「目标语言」自由文本归一到语言码（中/日/韩/英；其它为 other）。 */
export function targetLangCode(target: string): LangCode {
  const s = (target || "").toLowerCase();
  if (/中|汉|漢|chinese|mandarin|普通话|國語|国语|zh/.test(s)) return "zh";
  if (/日|japan|にほん|日本語|nihongo|ja(p|$)/.test(s)) return "ja";
  if (/韩|韓|korea|한국|hangul|ko(r|$)/.test(s)) return "ko";
  if (/英|english|en(g|$)/.test(s)) return "en";
  return "other";
}

/** 歌词语言是否与目标语言一致（一致则无需翻译，应跳过）。other 视为不一致（保守，宁可解析）。 */
export function lyricsMatchTarget(lines: string[], target: string): boolean {
  const d = detectLang(lines);
  if (d === "other") return false;
  return d === targetLangCode(target);
}
