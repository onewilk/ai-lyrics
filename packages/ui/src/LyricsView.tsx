import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { LyricLine } from "@ai-lyrics/lyrics-core";
import type { LineAnalysis } from "@ai-lyrics/ai-core";
import type { LyricsState } from "./hooks.js";
import { useT } from "./i18n.js";

export interface WordInfo {
  reading?: string;
  pos?: string;
  meaning: string;
}

interface Props {
  lyricsState: LyricsState;
  analyses: (LineAnalysis | null)[];
  activeIndex: number;
  /** 当前播放进度（毫秒），用于卡拉OK填充。 */
  progressMs: number;
  aiReady: boolean;
  aiError?: string;
  /** 是否对全部行展示解析；false 时仅当前高亮行展示。 */
  showAll: boolean;
  /** 非高亮行模糊上限（px）。 */
  blurMax: number;
  /** 当前高亮行是否持续显示高亮框。 */
  activeHighlightBox: boolean;
  /** 单词点查：开启后单词可悬浮查释义（仅英文）。 */
  wordLookup: boolean;
  /** 对单词查释义（行内关键词未命中时调用）。 */
  lookupWord: (word: string) => Promise<WordInfo | null>;
  onClickLine: (line: LyricLine) => void;
  onOpenSettings: () => void;
}

interface TipState {
  key: string;
  left: number;
  top: number;
  word: string;
  loading: boolean;
  info?: WordInfo | null;
}

/** 把文本切成「单词 / 非单词」片段，英文单词渲染为可悬浮 span。 */
function renderTokens(
  text: string,
  lineIndex: number,
  onEnter: (e: React.MouseEvent, lineIndex: number, word: string) => void,
  onLeave: () => void,
): ReactNode {
  const parts = text.split(/([A-Za-z][A-Za-z'’-]*)/);
  return parts.map((p, j) =>
    j % 2 === 1 ? (
      <span
        key={j}
        className="ail-word"
        onMouseEnter={(e) => onEnter(e, lineIndex, p)}
        onMouseLeave={onLeave}
      >
        {p}
      </span>
    ) : (
      <span key={j}>{p}</span>
    ),
  );
}

/** 单列：每行歌词下内联展示翻译/关键词，高亮并居中当前行。 */
export function LyricsView({
  lyricsState,
  analyses,
  activeIndex,
  progressMs,
  aiReady,
  aiError,
  showAll,
  blurMax,
  activeHighlightBox,
  wordLookup,
  lookupWord,
  onClickLine,
  onOpenSettings,
}: Props) {
  const t = useT();
  const activeRef = useRef<HTMLDivElement | null>(null);
  const lastUserScroll = useRef(0);
  const [tip, setTip] = useState<TipState | null>(null);
  const tipKey = useRef("");

  useEffect(() => {
    if (Date.now() - lastUserScroll.current < 2500) return;
    activeRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex]);

  const onWordEnter = (e: React.MouseEvent, lineIndex: number, word: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const left = Math.min(Math.max(rect.left + rect.width / 2, 120), window.innerWidth - 120);
    const top = rect.top;
    const key = `${lineIndex}:${word.toLowerCase()}`;
    tipKey.current = key;
    // 先查该行已解析的关键词
    const hit = (analyses[lineIndex]?.keywords ?? []).find(
      (k) => k.word.toLowerCase() === word.toLowerCase(),
    );
    if (hit) {
      setTip({ key, left, top, word, loading: false, info: { reading: hit.reading, pos: hit.pos, meaning: hit.meaning } });
      return;
    }
    setTip({ key, left, top, word, loading: true });
    void lookupWord(word).then((info) => {
      if (tipKey.current !== key) return;
      setTip({ key, left, top, word, loading: false, info });
    });
  };
  const onWordLeave = () => {
    tipKey.current = "";
    setTip(null);
  };
  const clearTip = () => {
    tipKey.current = "";
    setTip(null);
  };

  if (lyricsState.status === "idle")
    return <div className="ail-scroll"><div className="ail-hint">{t("hint.noTrack")}</div></div>;
  if (lyricsState.status === "loading")
    return (
      <div className="ail-scroll">
        <div className="ail-hint" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="ail-spinner" /> {t("hint.loading")}
        </div>
      </div>
    );
  if (lyricsState.status === "not-found")
    return <div className="ail-scroll"><div className="ail-hint">{t("hint.notFound1")}<br />{t("hint.notFound2")}</div></div>;
  if (lyricsState.status === "error")
    return <div className="ail-scroll"><div className="ail-hint">{t("hint.error", { msg: lyricsState.message })}</div></div>;

  const { lyrics } = lyricsState;

  if (!lyrics.synced) {
    // 纯文本歌词：无时间轴 → 不追随/不滚动/不卡拉OK，但照常逐行翻译+解析（全部展示）。
    return (
      <div className="ail-scroll" onWheel={() => (lastUserScroll.current = Date.now())}>
        {!aiReady && (
          <div className="ail-banner">
            {t("banner.aiOff")}{" "}
            <button className="ail-link" onClick={onOpenSettings}>{t("banner.aiOffLink")}</button>
          </div>
        )}
        {aiError && <div className="ail-banner err">{t("banner.partialFail", { msg: aiError })}</div>}
        <div className="ail-hint">{t("hint.plain")}</div>
        <div className="ail-merged">
          {lyrics.lines.map((text, i) => {
            const a = analyses[i] ?? null;
            const isInterlude = text.trim() === "";
            return (
              <div key={i} className={`ail-line plain${isInterlude ? " interlude" : ""}`}>
                <div className="ail-line-src">
                  {isInterlude ? "♪" : wordLookup ? renderTokens(text, i, onWordEnter, onWordLeave) : text || " "}
                </div>
                {!isInterlude && aiReady && a && (
                  <>
                    {a.translation && <div className="ail-line-trans">{a.translation}</div>}
                    {a.grammar && <div className="ail-line-gram">{t("label.grammar")} · {a.grammar}</div>}
                    {a.keywords.length > 0 && (
                      <div className="ail-line-kw">
                        {a.keywords.map((k, j) => (
                          <span className="ail-an-chip" key={j}>
                            <b>{k.word}</b>
                            {k.reading ? ` ${k.reading}` : ""} · {k.meaning}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        {tip && (
          <div className="ail-wordtip" style={{ left: tip.left, top: tip.top }}>
            <div className="ail-wordtip-w">
              {tip.word}
              {tip.info?.reading ? <span className="ail-wordtip-r"> {tip.info.reading}</span> : null}
              {tip.info?.pos ? <span className="ail-wordtip-p"> {tip.info.pos}</span> : null}
            </div>
            <div className="ail-wordtip-m">
              {tip.loading ? t("tip.loading") : tip.info?.meaning || t("tip.noMeaning")}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 卡拉OK：当前行在其时长内的已唱比例（行级，LRC 无逐字时间）。
  const cur = activeIndex >= 0 ? lyrics.lines[activeIndex] : undefined;
  const nxt = activeIndex >= 0 ? lyrics.lines[activeIndex + 1] : undefined;
  const lineDur = cur ? (nxt ? nxt.timeMs - cur.timeMs : 4000) : 1;
  const karaokeFrac = cur ? Math.min(1, Math.max(0, (progressMs - cur.timeMs) / Math.max(lineDur, 1))) : 0;

  return (
    <div
      className="ail-scroll"
      onWheel={() => {
        lastUserScroll.current = Date.now();
        clearTip();
      }}
      onTouchMove={() => (lastUserScroll.current = Date.now())}
    >
      {!aiReady && (
        <div className="ail-banner">
          {t("banner.aiOff")}{" "}
          <button className="ail-link" onClick={onOpenSettings}>{t("banner.aiOffLink")}</button>
        </div>
      )}
      {aiError && <div className="ail-banner err">{t("banner.partialFail", { msg: aiError })}</div>}

      <div className="ail-merged">
        {lyrics.lines.map((line, i) => {
          const a = analyses[i] ?? null;
          const isActive = i === activeIndex;
          const isInterlude = line.text === "";
          const cls = ["ail-line"];
          if (isActive) cls.push("active");
          else if (i < activeIndex) cls.push("passed");
          if (isInterlude) cls.push("interlude");
          if (isActive && activeHighlightBox) cls.push("boxed");

          const CLEAR_RADIUS = 1;
          const dist = activeIndex >= 0 ? Math.abs(i - activeIndex) : 0;
          // 模糊上限可配（blurMax），清晰区内不模糊；不透明度下限 0.62。
          const blurPx = Math.min(blurMax, Math.max(0, dist - CLEAR_RADIUS) * 0.4);
          const lineStyle: CSSProperties = isActive
            ? { filter: "none", opacity: 1 }
            : {
                filter: blurPx > 0 ? `blur(${blurPx.toFixed(2)}px)` : "none",
                opacity: Math.max(0.62, 1 - 0.05 * dist),
              };
          const srcStyle = isActive
            ? ({ ["--ail-kara"]: `${(karaokeFrac * 100).toFixed(1)}%` } as CSSProperties)
            : undefined;

          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              className={cls.join(" ")}
              style={lineStyle}
              onClick={() => onClickLine(line)}
              title={t("line.clickToPlay")}
            >
              <div className="ail-line-src" style={srcStyle}>
                {isInterlude ? "♪" : wordLookup ? renderTokens(line.text, i, onWordEnter, onWordLeave) : line.text}
              </div>

              {!isInterlude && aiReady && (isActive || showAll) && a && (
                <>
                  {a.translation && <div className="ail-line-trans">{a.translation}</div>}
                  {a.grammar && <div className="ail-line-gram">{t("label.grammar")} · {a.grammar}</div>}
                  {a.keywords.length > 0 && (
                    <div className="ail-line-kw">
                      {a.keywords.map((k, j) => (
                        <span className="ail-an-chip" key={j}>
                          <b>{k.word}</b>
                          {k.reading ? ` ${k.reading}` : ""} · {k.meaning}
                        </span>
                      ))}
                    </div>
                  )}
                  {isActive && a.examples.length > 0 && (
                    <div className="ail-an-ex">
                      {a.examples.map((e, j) => (
                        <div className="ail-an-ex-item" key={j}>
                          <div className="ail-ex-src">{e.src}</div>
                          <div className="ail-ex-zh">{e.zh}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {tip && (
        <div className="ail-wordtip" style={{ left: tip.left, top: tip.top }}>
          <div className="ail-wordtip-w">
            {tip.word}
            {tip.info?.reading ? <span className="ail-wordtip-r"> {tip.info.reading}</span> : null}
            {tip.info?.pos ? <span className="ail-wordtip-p"> {tip.info.pos}</span> : null}
          </div>
          <div className="ail-wordtip-m">
            {tip.loading ? t("tip.loading") : tip.info?.meaning || t("tip.noMeaning")}
          </div>
        </div>
      )}
    </div>
  );
}
