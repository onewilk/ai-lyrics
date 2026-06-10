import { useRef, useState } from "react";
import { MAX_MODELS, MAX_RECENT_MODELS, type AiSettings } from "@ai-lyrics/ai-core";
import { useT, UI_LANG_OPTIONS } from "./i18n.js";

interface Props {
  settings: AiSettings;
  onSave: (s: AiSettings) => void;
  onClose: () => void;
}

/** 小问号图标 + 原生悬浮提示。 */
function Help({ text }: { text: string }) {
  return (
    <span className="ail-help" title={text} aria-label={text} role="img">
      ?
    </span>
  );
}

/** 多模型标签输入：回车添加（≤3）、可拖动排序、可删除；下方为最近模型可点击加入。 */
function ModelTags({
  models,
  recent,
  onChange,
  onRecentChange,
}: {
  models: string[];
  recent: string[];
  onChange: (models: string[]) => void;
  onRecentChange: (recent: string[]) => void;
}) {
  const t = useT();
  const [input, setInput] = useState("");
  const dragIdx = useRef<number | null>(null);

  const addModel = (raw: string) => {
    const name = raw.trim();
    if (!name || models.includes(name) || models.length >= MAX_MODELS) return;
    onChange([...models, name]);
    onRecentChange([name, ...recent.filter((m) => m !== name)].slice(0, MAX_RECENT_MODELS));
    setInput("");
  };
  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = models.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onChange(next);
  };

  return (
    <div className="ail-field">
      <label>{t("model.label", { n: MAX_MODELS })}</label>
      <div className="ail-tags">
        {models.map((m, i) => (
          <span
            key={m}
            className="ail-tag"
            draggable
            onDragStart={() => (dragIdx.current = i)}
            onDragEnter={() => {
              if (dragIdx.current !== null && dragIdx.current !== i) {
                reorder(dragIdx.current, i);
                dragIdx.current = i;
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={() => (dragIdx.current = null)}
            title={t("model.dragSort")}
          >
            <span className="ail-tag-rank">{i + 1}</span>
            {m}
            <button className="ail-tag-x" onClick={() => onChange(models.filter((_, k) => k !== i))} aria-label={t("model.delete")}>
              ×
            </button>
          </span>
        ))}
        {models.length < MAX_MODELS && (
          <input
            className="ail-tag-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addModel(input);
              }
            }}
            placeholder={models.length === 0 ? t("model.placeholder.empty") : t("model.placeholder.more")}
          />
        )}
      </div>
      {recent.length > 0 && (
        <div className="ail-recent">
          <span className="ail-recent-label">{t("model.recent")}</span>
          {recent.map((m) => (
            <span key={m} className="ail-recent-tag">
              <button
                className="ail-recent-add"
                disabled={models.includes(m) || models.length >= MAX_MODELS}
                onClick={() => addModel(m)}
                title={t("model.addToQueue")}
              >
                {m}
              </button>
              <button
                className="ail-recent-x"
                onClick={() => onRecentChange(recent.filter((x) => x !== m))}
                aria-label={t("model.removeRecent")}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FontRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="ail-field">
      <label>
        {label}：<b>{value}px</b>
      </label>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function SettingsPanel({ settings, onSave, onClose }: Props) {
  const t = useT();
  const [s, setS] = useState<AiSettings>(settings);
  const [showFonts, setShowFonts] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const set = (patch: Partial<AiSettings>) => setS((prev) => ({ ...prev, ...patch }));
  const setFont = (k: keyof AiSettings["fontSizes"], v: number) =>
    setS((prev) => ({ ...prev, fontSizes: { ...prev.fontSizes, [k]: v } }));

  return (
    <>
      <div className="ail-modal-mask" onClick={onClose}>
        <div className="ail-modal" onClick={(e) => e.stopPropagation()}>
          <h3>{t("title.settings")}</h3>

          {/* AI 固定最上 */}
          <div className="ail-menu-row" onClick={() => setShowAI(true)}>
            <span className="ail-menu-title">{t("menu.aiSettings")}</span>
            <span className="ail-menu-value">{s.provider === "ollama" ? t("provider.ollama") : t("provider.openaiCompat")}</span>
          </div>

          <div className="ail-section-label">{t("section.features")}</div>

          <div className="ail-field">
            <label>{t("field.uiLang")}</label>
            <select value={s.uiLang} onChange={(e) => set({ uiLang: e.target.value })}>
              {UI_LANG_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="ail-field">
            <label>{t("field.targetLang")}</label>
            <input
              value={s.targetLang}
              onChange={(e) => set({ targetLang: e.target.value })}
              placeholder={t("field.targetLang.placeholder")}
            />
          </div>

          <div className="ail-field">
            <label className="ail-check">
              <input
                type="checkbox"
                checked={s.showAllAnalyses}
                onChange={(e) => set({ showAllAnalyses: e.target.checked })}
              />
              {t("check.showAll")}
            </label>
          </div>

          <div className="ail-field">
            <label className="ail-check">
              <input type="checkbox" checked={s.prefetch} onChange={(e) => set({ prefetch: e.target.checked })} />
              {t("check.prefetch")}
            </label>
          </div>
          {s.prefetch && (
            <div className="ail-field ail-subfield">
              <label>{t("field.prefetchCount")}</label>
              <select value={s.prefetchCount} onChange={(e) => set({ prefetchCount: Number(e.target.value) })}>
                <option value={1}>{t("prefetch.opt1")}</option>
                <option value={2}>{t("prefetch.opt2")}</option>
                <option value={3}>{t("prefetch.opt3")}</option>
              </select>
            </div>
          )}

          <div className="ail-section-label">{t("section.appearance")}</div>

          <div className="ail-menu-row" onClick={() => setShowFonts(true)}>
            <span className="ail-menu-title">{t("menu.fontSizes")}</span>
            <span className="ail-menu-value">{t("menu.fontSizes.value", { px: s.fontSizes.lyric })}</span>
          </div>

          <div className="ail-field">
            <label>
              {t("field.blur")}：<b>{s.blurMax.toFixed(1)}px</b>
            </label>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={s.blurMax}
              onChange={(e) => set({ blurMax: Number(e.target.value) })}
            />
          </div>

          <div className="ail-field">
            <label className="ail-check">
              <input
                type="checkbox"
                checked={s.activeHighlightBox}
                onChange={(e) => set({ activeHighlightBox: e.target.checked })}
              />
              {t("check.activeBox")}
            </label>
          </div>

          <div className="ail-field">
            <label>{t("field.background")}</label>
            <select
              value={s.background.mode}
              onChange={(e) =>
                set({ background: { ...s.background, mode: e.target.value as "kawarp" | "color" } })
              }
            >
              <option value="kawarp">{t("bg.kawarp")}</option>
              <option value="color">{t("bg.color")}</option>
            </select>
          </div>
          {s.background.mode === "color" && (
            <div className="ail-field ail-subfield">
              <label>{t("field.bgColor")}</label>
              <input
                type="color"
                value={s.background.color}
                onChange={(e) => set({ background: { ...s.background, color: e.target.value } })}
              />
            </div>
          )}

          <div className="ail-modal-actions">
            <button className="ail-btn ghost" onClick={onClose}>
              {t("btn.cancel")}
            </button>
            <button className="ail-btn primary" onClick={() => { onSave(s); onClose(); }}>
              {t("btn.save")}
            </button>
          </div>
        </div>
      </div>

      {showAI && (
        <div className="ail-modal-mask ail-modal-top" onClick={() => setShowAI(false)}>
          <div className="ail-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t("title.aiSettings")}</h3>

            <div className="ail-field">
              <label>{t("field.provider")}</label>
              <div className="ail-radios">
                <label>
                  <input type="radio" checked={s.provider === "ollama"} onChange={() => set({ provider: "ollama" })} />
                  {t("provider.ollama")}
                </label>
                <label>
                  <input type="radio" checked={s.provider === "openai"} onChange={() => set({ provider: "openai" })} />
                  {t("provider.openaiCompat")}
                </label>
              </div>
            </div>

            {s.provider === "ollama" && (
              <div className="ail-group">
                <div className="ail-field">
                  <label>{t("field.ollamaUrl")}</label>
                  <input
                    value={s.ollama.baseUrl}
                    onChange={(e) => set({ ollama: { ...s.ollama, baseUrl: e.target.value } })}
                    placeholder="http://localhost:11434"
                  />
                </div>
                <ModelTags
                  models={s.ollama.models}
                  recent={s.recentModels}
                  onChange={(models) => set({ ollama: { ...s.ollama, models } })}
                  onRecentChange={(recentModels) => set({ recentModels })}
                />
              </div>
            )}

            {s.provider === "openai" && (
              <div className="ail-group">
                <div className="ail-field">
                  <label>{t("field.baseUrl")}</label>
                  <input
                    value={s.openai.baseUrl}
                    onChange={(e) => set({ openai: { ...s.openai, baseUrl: e.target.value } })}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className="ail-field">
                  <label>{t("field.apiKey")}</label>
                  <input
                    type="password"
                    value={s.openai.apiKey}
                    onChange={(e) => set({ openai: { ...s.openai, apiKey: e.target.value } })}
                    placeholder="sk-..."
                  />
                </div>
                <ModelTags
                  models={s.openai.models}
                  recent={s.recentModels}
                  onChange={(models) => set({ openai: { ...s.openai, models } })}
                  onRecentChange={(recentModels) => set({ recentModels })}
                />
              </div>
            )}

            <div className="ail-field">
              <label className="ail-check">
                <input type="checkbox" checked={s.streaming} onChange={(e) => set({ streaming: e.target.checked })} />
                {t("check.streaming")}
              </label>
            </div>

            <div className="ail-field">
              <label className="ail-check">
                <input
                  type="checkbox"
                  checked={s.disableThinking}
                  onChange={(e) => set({ disableThinking: e.target.checked })}
                />
                {t("check.disableThinking")}
                <Help text={t("help.disableThinking")} />
              </label>
            </div>

            <div className="ail-field">
              <label>
                {t("field.chunkSize")}：<b>{s.chunkSize}</b> {t("unit.lines")}
                <Help text={t("help.chunkSize")} />
              </label>
              <input
                type="range"
                min={8}
                max={44}
                step={1}
                value={s.chunkSize}
                onChange={(e) => set({ chunkSize: Number(e.target.value) })}
              />
            </div>

            <div className="ail-field">
              <label className="ail-check">
                <input
                  type="checkbox"
                  checked={s.useCorsProxy}
                  onChange={(e) => set({ useCorsProxy: e.target.checked })}
                />
                {t("check.corsProxy")}
                <Help text={t("help.corsProxy")} />
              </label>
            </div>

            <div className="ail-field">
              <label className="ail-check">
                <input
                  type="checkbox"
                  checked={s.simpleRequest}
                  onChange={(e) => set({ simpleRequest: e.target.checked })}
                />
                {t("check.simpleRequest")}
                <Help text={t("help.simpleRequest")} />
              </label>
            </div>

            <div className="ail-modal-actions">
              <button className="ail-btn primary" onClick={() => setShowAI(false)}>{t("btn.done")}</button>
            </div>
          </div>
        </div>
      )}

      {showFonts && (
        <div className="ail-modal-mask ail-modal-top" onClick={() => setShowFonts(false)}>
          <div className="ail-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t("title.fontSizes")}</h3>
            <FontRow label={t("font.lyric")} value={s.fontSizes.lyric} min={18} max={44} onChange={(v) => setFont("lyric", v)} />
            <FontRow label={t("font.active")} value={s.fontSizes.active} min={20} max={52} onChange={(v) => setFont("active", v)} />
            <FontRow label={t("font.translation")} value={s.fontSizes.translation} min={12} max={30} onChange={(v) => setFont("translation", v)} />
            <FontRow label={t("font.grammar")} value={s.fontSizes.grammar} min={10} max={26} onChange={(v) => setFont("grammar", v)} />
            <FontRow label={t("font.analysis")} value={s.fontSizes.analysis} min={12} max={28} onChange={(v) => setFont("analysis", v)} />
            <div className="ail-modal-actions">
              <button className="ail-btn primary" onClick={() => setShowFonts(false)}>{t("btn.done")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
