/** 作用域化样式（注入到 document.head 一次）。宿主无关。 */
export const STYLE_ID = "ai-lyrics-styles";

export const css = `
.ail-root {
  position: absolute; inset: 0;
  box-sizing: border-box;
  /* 安全内边距：由宿主按与顶栏/播放栏的实际重叠量注入；默认 0。 */
  padding-top: var(--ail-top, 0px);
  padding-bottom: var(--ail-bottom, 0px);
  display: flex; flex-direction: column;
  color: #f2f2f2;
  font-family: -apple-system, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: #0b0b0f;
  overflow: hidden;
}
/* Kawarp 动态背景容器（WebGL canvas 充满）。 */
.ail-bg { position: absolute; inset: 0; z-index: 0; overflow: hidden; }
.ail-bg-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
/* 柔和暗角：四周与底部压暗，保证歌词可读（叠在 canvas 之上）。 */
.ail-bg::after {
  content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background:
    radial-gradient(120% 80% at 50% 34%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.18) 64%, rgba(0,0,0,0.46) 100%),
    linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 72%, rgba(0,0,0,0.34) 100%);
}
.ail-window { position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%; }

/* 悬浮设置按钮（右下角） */
.ail-fab {
  position: absolute; right: 22px; bottom: 22px; z-index: 4;
  width: 52px; height: 52px; border-radius: 50%;
  background: rgba(20,20,26,.7); color: #f2f2f2; border: 1px solid rgba(255,255,255,.12);
  font-size: 24px; line-height: 1; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  backdrop-filter: blur(8px); box-shadow: 0 4px 16px rgba(0,0,0,.4);
  opacity: .5; transition: opacity .2s, background .2s, transform .2s;
}
.ail-fab:hover { opacity: 1; background: rgba(40,40,50,.9); transform: scale(1.06); }
.ail-fab:active { transform: scale(0.92); }
.ail-toast {
  position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 6;
  background: rgba(20,20,26,.92); color: #fff; font-size: 13px; padding: 9px 16px; border-radius: 20px;
  box-shadow: 0 4px 16px rgba(0,0,0,.5); border: 1px solid rgba(255,255,255,.12); pointer-events: none;
}

/* 单列滚动区 */
.ail-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.ail-scroll::-webkit-scrollbar { width: 8px; }
.ail-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 4px; }
.ail-merged { max-width: 860px; margin: 0 auto; padding: 32vh 24px; }

.ail-line {
  padding: 12px 16px; border-radius: 12px; cursor: pointer;
  /* 平滑过渡模糊/淡化/缩放，营造"逐行聚焦"的景深感。 */
  transition: filter .38s ease, opacity .38s ease, transform .32s ease, background .2s;
}
/* 悬浮任意行：仅去模糊 + 轻微提亮（不显示卡片高亮框）。 */
.ail-line:hover {
  filter: none !important;
  opacity: 1 !important;
  background: rgba(255,255,255,.06);
}
.ail-line:hover .ail-line-src { color: rgba(255,255,255,.95); }
.ail-line.active:hover .ail-line-src { color: transparent; }

/* 当前高亮行常驻显示「悬浮高亮」：与 :hover 同款的轻微提亮背景（不再是厚重卡片）。 */
.ail-line.boxed { background: rgba(255,255,255,.06); }
.ail-line.active { transform: scale(1.03); transform-origin: left center; }
.ail-line-src {
  font-size: var(--ail-fs-lyric, 29px); font-weight: 700; line-height: 1.4; color: rgba(255,255,255,.5);
  transition: color .2s, font-size .2s;
}
.ail-line.passed .ail-line-src { color: rgba(255,255,255,.36); }

/* 高亮行：卡拉OK 渐变填充（--ail-kara 为已唱比例）+ 泛光 + 字号 +2 提升辨识度。 */
.ail-line.active .ail-line-src {
  font-size: var(--ail-fs-active, 34px);
  color: transparent;
  background-image: linear-gradient(
    90deg,
    #ffffff 0%,
    #ffffff calc(var(--ail-kara, 0%)),
    rgba(255,255,255,0.42) calc(var(--ail-kara, 0%) + 1.5%),
    rgba(255,255,255,0.42) 100%
  );
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter:
    drop-shadow(0 0 12px rgba(255,255,255,0.5))
    drop-shadow(0 0 26px rgba(255,255,255,0.28));
  transition: filter .3s ease;
}
.ail-line.interlude { cursor: pointer; }
.ail-line.interlude .ail-line-src { font-size: 18px; color: rgba(255,255,255,.3); }
.ail-line.plain { cursor: default; padding: 6px 16px; }
.ail-line.plain .ail-line-src { font-size: var(--ail-fs-lyric, 29px); font-weight: 500; color: rgba(255,255,255,.8); }
.ail-line.plain:hover { background: none; }

.ail-line-trans { font-size: var(--ail-fs-translation, 18px); color: #b9e6cb; margin-top: 6px; line-height: 1.5; }
.ail-line-trans.pending { color: #888; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.ail-line-trans.err { color: #ff9b9b; font-size: 14px; word-break: break-word; }
/* 语法做成标签（与关键词区分色：暖金底）。 */
.ail-line-gram {
  display: inline-block; font-size: var(--ail-fs-grammar, 16px); color: #f0d79a;
  background: rgba(217,176,90,.14); border: 1px solid rgba(217,176,90,.28);
  border-radius: 6px; padding: 3px 9px; margin-top: 7px; line-height: 1.45;
}

/* 单词点查：可悬浮单词 + 释义气泡 */
.ail-word { cursor: pointer; border-radius: 3px; }
.ail-word:hover { text-decoration: underline; text-decoration-color: rgba(255,255,255,.7); text-underline-offset: 3px; }
.ail-wordtip {
  position: fixed; z-index: 7; transform: translate(-50%, calc(-100% - 10px));
  max-width: 320px; background: rgba(18,18,24,.97); color: #fff;
  border: 1px solid rgba(255,255,255,.14); border-radius: 10px; padding: 8px 12px;
  box-shadow: 0 8px 28px rgba(0,0,0,.55); pointer-events: none;
}
.ail-wordtip-w { font-size: 14px; font-weight: 700; }
.ail-wordtip-r { font-size: 12px; color: #9bd; font-weight: 400; }
.ail-wordtip-p { font-size: 12px; color: #888; font-style: italic; font-weight: 400; }
.ail-wordtip-m { font-size: 13px; color: #cfe9d8; margin-top: 4px; line-height: 1.5; }
.ail-line-kw { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ail-an-chip { font-size: calc(var(--ail-fs-analysis, 18px) - 5px); color: #cdd; background: rgba(255,255,255,.07); border-radius: 6px; padding: 2px 8px; }
.ail-an-chip b { color: #fff; }
.ail-an-ex { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.ail-an-ex-item { font-size: calc(var(--ail-fs-analysis, 18px) - 4px); line-height: 1.45; border-left: 2px solid rgba(29,185,84,.5); padding-left: 8px; }
.ail-ex-src { color: #fff; }
.ail-ex-zh { color: #aaa; }

.ail-banner { max-width: 860px; margin: 12px auto 0; padding: 8px 16px; font-size: 13px; color: #bdebc9; }
.ail-banner.err { color: #ffb3b3; }
.ail-link { background: none; border: none; color: #1db954; cursor: pointer; text-decoration: underline; font: inherit; padding: 0; }

.ail-hint { color: #888; font-size: 14px; padding: 32px 28px; line-height: 1.6; max-width: 860px; margin: 0 auto; }
.ail-spinner { width: 22px; height: 22px; border: 3px solid rgba(255,255,255,.2); border-top-color: #1db954; border-radius: 50%; animation: ail-spin .8s linear infinite; display:inline-block; }
@keyframes ail-spin { to { transform: rotate(360deg); } }
.ail-dot { width: 7px; height: 7px; border-radius: 50%; background: #1db954; animation: ail-pulse 1s ease-in-out infinite; }
@keyframes ail-pulse { 0%,100% { opacity: .3; } 50% { opacity: 1; } }

/* 设置弹窗 */
.ail-modal-mask { position: absolute; inset: 0; z-index: 5; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; }
.ail-modal { width: 460px; max-width: 92%; max-height: 86%; overflow-y: auto; background: #181820; border-radius: 14px; padding: 22px 24px; box-shadow: 0 18px 60px rgba(0,0,0,.6); }
.ail-modal h3 { margin: 0 0 16px; font-size: 18px; }
.ail-modal-top { z-index: 8; }
/* 二级弹窗入口：整行可点，左标题右文字 + › */
.ail-menu-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 11px 12px; margin-bottom: 12px; border-radius: 10px; cursor: pointer;
  background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); transition: background .15s;
}
.ail-menu-row:hover { background: rgba(255,255,255,.1); }
.ail-menu-row .ail-menu-title { font-size: 14px; color: var(--spice-text, #fff); }
.ail-menu-row .ail-menu-value { font-size: 13px; color: var(--spice-subtext, #9aa); display: inline-flex; align-items: center; gap: 6px; }
.ail-menu-row .ail-menu-value::after { content: "›"; font-size: 18px; color: #888; }
/* 设置分组小标题 */
.ail-section-label { font-size: 11px; letter-spacing: .08em; color: #777; margin: 16px 0 8px; text-transform: uppercase; }
.ail-section-label:first-of-type { margin-top: 4px; }
.ail-modal input[type="range"] { width: 100%; accent-color: var(--spice-button, #1db954); }
.ail-modal input[type="color"] { width: 56px; height: 34px; padding: 2px; background: #0e0e14; border: 1px solid #333; border-radius: 8px; cursor: pointer; }

/* 左上角解析进度提示 */
.ail-progress {
  position: absolute; top: 14px; left: 18px; z-index: 4;
  font-size: 12px; color: #cfe9d8; background: rgba(18,18,24,.7);
  border: 1px solid rgba(255,255,255,.12); border-radius: 14px; padding: 5px 12px;
  display: inline-flex; align-items: center; gap: 7px; backdrop-filter: blur(8px);
  transition: opacity .4s ease;
}
.ail-progress .ail-dot { width: 7px; height: 7px; }
.ail-progress.fail { color: #ff8a8a; border-color: rgba(255,90,90,.4); }
.ail-field { margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px; }
.ail-field label { font-size: 13px; color: #b3b3b3; }
.ail-field input, .ail-field select { background: #0e0e14; border: 1px solid #333; color: #fff; border-radius: 8px; padding: 9px 11px; font-size: 14px; }
.ail-check { flex-direction: row !important; align-items: center; gap: 8px; color: #fff !important; font-size: 14px !important; cursor: pointer; }
.ail-check input { width: auto; }
.ail-hint-sm { font-size: 12px; color: #888; line-height: 1.5; }
.ail-radios { display: flex; gap: 16px; }
.ail-radios label { display: flex; align-items: center; gap: 6px; color: #fff; font-size: 14px; cursor: pointer; }
.ail-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
/* 按钮跟随 Spicetify 主题变量（无主题时回退到 Spotify 绿）。 */
.ail-btn {
  border: none; border-radius: 500px; padding: 9px 22px; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: transform .1s ease, filter .15s ease, background .15s ease; font-family: inherit;
}
.ail-btn:hover { transform: scale(1.03); }
.ail-btn:active { transform: scale(0.98); }
.ail-btn.primary { background: var(--spice-button, #1db954); color: #000; font-weight: 800; }
.ail-btn.primary:hover { filter: brightness(1.1); }
.ail-btn.ghost { background: transparent; color: var(--spice-subtext, #b3b3b3); }
.ail-btn.ghost:hover { color: var(--spice-text, #fff); background: rgba(255,255,255,.08); }
/* 次要按钮：有底色与描边、低调但清晰 */
.ail-btn.secondary {
  background: rgba(255,255,255,.09); color: var(--spice-text, #fff);
  border: 1px solid rgba(255,255,255,.16); padding: 8px 16px; font-weight: 600;
}
.ail-btn.secondary:hover { background: rgba(255,255,255,.16); }

/* 问号提示 */
.ail-help {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; margin-left: 6px; border-radius: 50%;
  background: rgba(255,255,255,.15); color: #fff; font-size: 11px; font-weight: 700;
  cursor: help; user-select: none; flex: none;
}
.ail-subfield { margin-left: 8px; }
.ail-subfield select { background: #0e0e14; border: 1px solid #333; color: #fff; border-radius: 8px; padding: 8px 10px; font-size: 14px; }

/* 模型标签 */
.ail-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.ail-tag {
  display: inline-flex; align-items: center; gap: 6px; cursor: grab;
  background: var(--spice-card, rgba(255,255,255,.1)); color: var(--spice-text, #fff);
  border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 4px 6px 4px 8px; font-size: 13px;
}
.ail-tag:active { cursor: grabbing; }
.ail-tag-rank {
  font-size: 10px; color: var(--spice-main, #000); background: var(--spice-button, #1db954);
  border-radius: 4px; width: 14px; height: 14px; display: inline-flex; align-items: center; justify-content: center; font-weight: 700;
}
.ail-tag-x, .ail-recent-x { background: none; border: none; color: #bbb; cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px; }
.ail-tag-x:hover, .ail-recent-x:hover { color: #fff; }
.ail-tag-input { flex: 1; min-width: 120px; background: #0e0e14; border: 1px solid #333; color: #fff; border-radius: 8px; padding: 7px 10px; font-size: 13px; }
.ail-recent { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
.ail-recent-label { font-size: 12px; color: #888; }
.ail-recent-tag { display: inline-flex; align-items: center; background: rgba(255,255,255,.05); border-radius: 7px; }
.ail-recent-add { background: none; border: none; color: #bcd; cursor: pointer; font-size: 12px; padding: 3px 4px 3px 8px; }
.ail-recent-add:hover:not(:disabled) { color: #fff; }
.ail-recent-add:disabled { color: #555; cursor: default; }
.ail-group { border: 1px solid #2a2a33; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
.ail-group.dim { opacity: .45; }
`;

export function injectStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const el = doc.createElement("style");
  el.id = STYLE_ID;
  el.textContent = css;
  doc.head.appendChild(el);
}
