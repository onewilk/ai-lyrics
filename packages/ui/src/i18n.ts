import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";

/** 受支持的界面语言码。新增语言 = 往 DICTS 里加一份词典 + UI_LANG_OPTIONS + normalizeLocale 分支。 */
export type UiLang = "en" | "zh-CN";

/** 设置里可选项：auto（跟随宿主/Spotify）+ 各具体语言。 */
export type UiLangSetting = "auto" | UiLang;

/** 供设置下拉用的语言清单（label 用各语言自称，便于用户辨认）。 */
export const UI_LANG_OPTIONS: { code: UiLangSetting; label: string }[] = [
  { code: "auto", label: "Auto" },
  { code: "en", label: "English" },
  { code: "zh-CN", label: "简体中文" },
];

type Dict = Record<string, string>;

/** 英文：作为基准与回退（任何语言缺失的键都回退到这里）。 */
const en: Dict = {
  "app.name": "AI Lyrics",

  // 进度
  "progress.analyzing": "Analyzing {done}/{total}",
  "progress.done": "Analysis complete",
  "progress.donePartial": "Analysis complete {done}/{total}",
  "progress.failed": "Analysis failed",

  // 提示
  "hint.noTrack": "Nothing is playing right now.",
  "hint.loading": "Fetching lyrics…",
  "hint.notFound1": "No lyrics found for this track.",
  "hint.notFound2": "It may be instrumental, or not yet in any source.",
  "hint.error": "Failed to load lyrics: {msg}",
  "hint.plain": "No synced lyrics; showing plain text.",
  "banner.aiOff": "Translation is off —",
  "banner.aiOffLink": "configure AI in ⚙",
  "banner.partialFail": "Some analyses failed: {msg}",
  "label.grammar": "Grammar",
  "tip.loading": "Looking up…",
  "tip.noMeaning": "(no definition found)",
  "line.clickToPlay": "Click to play from here",

  // 悬浮按钮 / toast
  "fab.title": "Click: settings · Long-press: re-fetch & re-analyze lyrics",
  "settings.aria": "Settings",
  "toast.noTrack": "Nothing playing — can't fetch",
  "toast.refetchAnalyze": "Re-fetching lyrics and re-analyzing…",
  "toast.refetch": "Re-fetching lyrics…",

  // 设置 - 标题/分区
  "title.settings": "Settings",
  "title.aiSettings": "AI Settings",
  "title.fontSizes": "Text size",
  "section.features": "Features",
  "section.appearance": "Appearance",
  "menu.aiSettings": "AI Settings",
  "provider.ollama": "Local Ollama",
  "provider.openaiCompat": "OpenAI-compatible",

  // 设置 - 功能
  "field.uiLang": "Interface language",
  "field.targetLang": "Translation target language",
  "field.targetLang.placeholder": "English",
  "check.showAll": "Show analysis for all lines (default: current line only)",
  "check.prefetch": "Background prefetch (analyze & cache ahead)",
  "field.prefetchCount": "Prefetch count (including current track)",
  "prefetch.opt1": "1 (current only)",
  "prefetch.opt2": "2 (current + next)",
  "prefetch.opt3": "3 (current + next two)",

  // 设置 - 外观
  "menu.fontSizes": "Text size",
  "menu.fontSizes.value": "Default {px}px",
  "field.blur": "Blur of non-active lines",
  "check.activeBox": "Keep hover highlight on the active line",
  "field.background": "Background",
  "bg.kawarp": "Dynamic cover (default)",
  "bg.color": "Solid color",
  "field.bgColor": "Background color",

  // 设置 - AI
  "field.provider": "AI provider",
  "field.ollamaUrl": "Ollama URL",
  "field.baseUrl": "Base URL",
  "field.apiKey": "API Key",
  "check.streaming": "Streaming output (show as generated, feels faster)",
  "check.disableThinking": "Disable deep thinking (faster, may slightly reduce accuracy)",
  "help.disableThinking":
    "For reasoning models (e.g. deepseek-v4-pro), skips the think-before-answer phase for a big speedup. The request includes several common disable flags (enable_thinking / reasoning_effort / chat_template_kwargs.thinking); the gateway uses whichever it recognizes. If a strict gateway returns 400 for unknown params, it falls back step by step to a working request (thinking may resume then).",
  "field.chunkSize": "Lines per request",
  "unit.lines": "lines",
  "help.chunkSize":
    "How many lyric lines are sent to the model per request. Smaller: each batch returns sooner and lines near the current one appear earlier, but there are more requests and the whole-song context is resent each time, so total time can be longer. Larger: each batch is slower to produce and the first screen waits longer; too large may exceed the model's output limit and get truncated (missing lines). ~22 is recommended for small local models; a slow remote endpoint can go higher (e.g. 40+) to reduce request count.",
  "check.corsProxy": "Route requests via Spicetify proxy",
  "help.corsProxy":
    "By default requests go directly to your endpoint (keep OFF for intranet / CORS-enabled endpoints). Only enable when the endpoint is public and a direct call fails with “Failed to fetch” — it routes the request through a third-party public proxy.",
  "check.simpleRequest": "Simple request (skip CORS preflight)",
  "help.simpleRequest":
    "Try this when an intranet endpoint fails because its preflight (OPTIONS) returns a redirect: sends no Authorization or JSON headers to skip preflight. Only works for endpoints that need no auth header and return CORS headers (API Key can be left empty here).",

  // 字号项
  "font.lyric": "Default lyrics",
  "font.active": "Active lyrics",
  "font.translation": "Translation text",
  "font.grammar": "Grammar text",
  "font.analysis": "Other analysis text (keywords/examples)",

  // 模型标签
  "model.label": "Models (fallback in order, Enter to add, up to {n}, drag to reorder)",
  "model.placeholder.empty": "Type a model name and press Enter",
  "model.placeholder.more": "Add another…",
  "model.recent": "Recent:",
  "model.dragSort": "Drag to reorder",
  "model.delete": "Remove",
  "model.addToQueue": "Add to model queue",
  "model.removeRecent": "Remove from recent",

  // 按钮
  "btn.cancel": "Cancel",
  "btn.save": "Save",
  "btn.done": "Done",
};

/** 简体中文（项目原始文案）。 */
const zhCN: Dict = {
  "app.name": "AI 歌词",

  "progress.analyzing": "解析中 {done}/{total}",
  "progress.done": "解析完成",
  "progress.donePartial": "解析完成 {done}/{total}",
  "progress.failed": "解析失败",

  "hint.noTrack": "暂无正在播放的歌曲。",
  "hint.loading": "正在检索歌词…",
  "hint.notFound1": "未找到这首歌的歌词。",
  "hint.notFound2": "可能是纯音乐，或来源暂未收录。",
  "hint.error": "歌词加载失败：{msg}",
  "hint.plain": "未找到同步歌词，显示纯文本。",
  "banner.aiOff": "翻译未开启 ——",
  "banner.aiOffLink": "在 ⚙ 配置 AI",
  "banner.partialFail": "部分解析失败：{msg}",
  "label.grammar": "语法",
  "tip.loading": "查询中…",
  "tip.noMeaning": "（未找到释义）",
  "line.clickToPlay": "点击从此处播放",

  "fab.title": "点击：设置 · 长按：重新检索歌词并解析",
  "settings.aria": "设置",
  "toast.noTrack": "暂无播放，无法检索",
  "toast.refetchAnalyze": "正在重新检索歌词并解析…",
  "toast.refetch": "正在重新检索歌词…",

  "title.settings": "设置",
  "title.aiSettings": "AI 设置",
  "title.fontSizes": "文本大小",
  "section.features": "功能",
  "section.appearance": "外观",
  "menu.aiSettings": "AI 设置",
  "provider.ollama": "本地 Ollama",
  "provider.openaiCompat": "OpenAI 兼容",

  "field.uiLang": "界面语言",
  "field.targetLang": "翻译目标语言",
  "field.targetLang.placeholder": "中文",
  "check.showAll": "显示全部行的解析（默认仅当前高亮行）",
  "check.prefetch": "后台预取（提前解析并缓存）",
  "field.prefetchCount": "预取数量（含当前歌曲）",
  "prefetch.opt1": "1（仅当前）",
  "prefetch.opt2": "2（当前 + 下一首）",
  "prefetch.opt3": "3（当前 + 后两首）",

  "menu.fontSizes": "文本大小",
  "menu.fontSizes.value": "默认 {px}px",
  "field.blur": "非高亮行模糊",
  "check.activeBox": "当前行持续显示悬浮高亮",
  "field.background": "背景",
  "bg.kawarp": "动态封面（默认）",
  "bg.color": "固定纯色",
  "field.bgColor": "背景颜色",

  "field.provider": "AI 提供方",
  "field.ollamaUrl": "Ollama 地址",
  "field.baseUrl": "Base URL",
  "field.apiKey": "API Key",
  "check.streaming": "流式输出（边生成边显示，感知更快）",
  "check.disableThinking": "关闭深度思考（更快，可能略降准确度）",
  "help.disableThinking":
    "对推理模型（如 deepseek-v4-pro）跳过先思考再作答的阶段，显著提速。请求会带上多种主流关闭字段（enable_thinking / reasoning_effort / chat_template_kwargs.thinking 等），网关只取认识的；若网关对未知参数严格报 400，会自动逐级回退到可用请求（此时思考可能恢复）。",
  "field.chunkSize": "每块行数",
  "unit.lines": "行",
  "help.chunkSize":
    "每次请求向模型发送多少行歌词。偏小：每块更快返回、当前行附近更早出现，但请求次数变多、整首歌的语境会被反复重发，总耗时反而偏长；偏大：单块产出更慢、首屏等待更久，过大还可能超出模型输出上限被截断而漏行。本地小模型推荐 22 左右；较慢的远端端点可调大（如 40+）以减少请求次数。",
  "check.corsProxy": "经 Spicetify 代理转发请求",
  "help.corsProxy":
    "默认直连你的端点（内网/支持 CORS 的端点请保持关闭）。仅当端点为公网且直连报 “Failed to fetch” 时才开启——会把请求经第三方公共代理转发。",
  "check.simpleRequest": "免预检请求（跳过 CORS 预检）",
  "help.simpleRequest":
    "内网端点对预检(OPTIONS)返回重定向导致失败时可尝试：不发 Authorization 与 JSON 头以跳过预检。仅适用于无需鉴权头、且响应带 CORS 头的端点（此时 API Key 可留空）。",

  "font.lyric": "默认歌词",
  "font.active": "高亮歌词",
  "font.translation": "翻译文本",
  "font.grammar": "语法文本",
  "font.analysis": "其他解析文本（关键词/例句）",

  "model.label": "模型（按序 fallback，回车添加，最多 {n} 个，可拖动排序）",
  "model.placeholder.empty": "输入模型名后回车",
  "model.placeholder.more": "再加一个…",
  "model.recent": "最近：",
  "model.dragSort": "拖动排序",
  "model.delete": "删除",
  "model.addToQueue": "加入模型队列",
  "model.removeRecent": "从最近移除",

  "btn.cancel": "取消",
  "btn.save": "保存",
  "btn.done": "完成",
};

const DICTS: Record<UiLang, Dict> = { en, "zh-CN": zhCN };

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** 构造翻译函数：命中当前语言 → 回退英文 → 回退键名；支持 {var} 插值。 */
export function makeT(lang: UiLang): TFn {
  const dict = DICTS[lang] ?? en;
  return (key, vars) => {
    let str = dict[key] ?? en[key] ?? key;
    if (vars) for (const k of Object.keys(vars)) str = str.split(`{${k}}`).join(String(vars[k]));
    return str;
  };
}

/** 把任意 locale 字符串（zh-CN / en-US…）归一到受支持语言；无法识别回退英文。 */
export function normalizeLocale(locale: string | undefined | null): UiLang {
  const s = (locale || "").toLowerCase();
  if (s.startsWith("zh")) return "zh-CN";
  return "en";
}

/** 解析设置中的界面语言：具体语言直接用；auto 时取宿主 locale（取不到回退英文）。 */
export function resolveUiLang(setting: UiLangSetting | string | undefined, hostLocale?: string): UiLang {
  if (setting === "en" || setting === "zh-CN") return setting;
  const fallback = typeof navigator !== "undefined" ? navigator.language : undefined;
  return normalizeLocale(hostLocale ?? fallback);
}

const I18nContext = createContext<TFn>(makeT("en"));

/** 提供翻译函数给子树；lang 变化时重建。 */
export function I18nProvider({ lang, children }: { lang: UiLang; children: ReactNode }) {
  const t = useMemo(() => makeT(lang), [lang]);
  return createElement(I18nContext.Provider, { value: t }, children);
}

/** 取当前翻译函数。 */
export function useT(): TFn {
  return useContext(I18nContext);
}
