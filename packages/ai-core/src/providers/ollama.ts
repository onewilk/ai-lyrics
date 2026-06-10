import {
  buildBatchSystemPrompt,
  buildBatchUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  makeStreamLineEmitter,
  parseAnalysis,
  parseBatchAnalysis,
} from "../prompt.js";
import { extractContent } from "../stream.js";
import type { AiProvider, AnalyzeInput, BatchAnalyzeContext, LineAnalysis } from "../types.js";

export interface OllamaOptions {
  baseUrl?: string;
  /** 候选模型（按序 fallback）。 */
  models?: string[];
  fetchImpl?: typeof fetch;
  streaming?: boolean;
  /** 关闭深度思考：Ollama 用顶层 think:false（仅对支持思考的模型有意义）。 */
  disableThinking?: boolean;
}

/**
 * 本地 Ollama 提供方（默认）。调 /api/chat，format:"json" 强制 JSON。
 * 支持多模型 fallback 与流式增量。
 */
export class OllamaProvider implements AiProvider {
  readonly id = "ollama";
  private readonly baseUrl: string;
  private readonly models: string[];
  private readonly fetchImpl: typeof fetch;
  private readonly streaming: boolean;
  private readonly noThink: boolean;

  constructor(opts: OllamaOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "http://localhost:11434").replace(/\/$/, "");
    this.models = (opts.models ?? ["qwen2.5"]).filter(Boolean);
    if (this.models.length === 0) this.models = ["qwen2.5"];
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.streaming = opts.streaming ?? false;
    this.noThink = opts.disableThinking ?? false;
  }

  async analyzeLine(input: AnalyzeInput, signal?: AbortSignal): Promise<LineAnalysis> {
    const targetLang = input.targetLang ?? "中文";
    const content = await this.complete(buildSystemPrompt(targetLang), buildUserPrompt(input), signal);
    return parseAnalysis(content);
  }

  async analyzeLines(
    lines: string[],
    ctx: BatchAnalyzeContext,
    signal?: AbortSignal,
    onLine?: (sliceIndex: number, analysis: LineAnalysis) => void,
  ): Promise<LineAnalysis[]> {
    const targetLang = ctx.targetLang ?? "中文";
    const onProgress = onLine ? makeStreamLineEmitter(lines.length, onLine) : undefined;
    const content = await this.complete(
      buildBatchSystemPrompt(targetLang),
      buildBatchUserPrompt(lines, {
        targetLang,
        trackTitle: ctx.trackTitle,
        artist: ctx.artist,
        contextLines: ctx.contextLines,
      }),
      signal,
      onProgress,
    );
    return parseBatchAnalysis(content, lines.length);
  }

  private async complete(
    system: string,
    user: string,
    signal?: AbortSignal,
    onProgress?: (full: string) => void,
  ): Promise<string> {
    let lastErr: unknown;
    for (const model of this.models) {
      try {
        return await this.completeOne(system, user, model, signal, onProgress);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") throw e;
        lastErr = e;
      }
    }
    throw lastErr ?? new Error("无可用模型");
  }

  private async completeOne(
    system: string,
    user: string,
    model: string,
    signal?: AbortSignal,
    onProgress?: (full: string) => void,
  ): Promise<string> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        model,
        format: "json",
        stream: this.streaming,
        options: { temperature: 0.2 },
        ...(this.noThink ? { think: false } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await safeText(res)}`);

    // Ollama 流式为 NDJSON（每行一个 {"message":{"content":...}}），与 readContentStream 的
    // SSE/JSON 解析不完全一致；为稳妥这里统一缓冲读取后解析（onProgress 仍在末尾回调一次）。
    const text = await res.text();
    const content = parseOllamaContent(text);
    if (onProgress && content) onProgress(content);
    return content;
  }
}

/** 解析 Ollama 返回：非流式为单 JSON；流式为 NDJSON（多行 message.content 累加）。 */
function parseOllamaContent(text: string): string {
  const trimmed = text.trimStart();
  // NDJSON 流式
  if (trimmed.includes('"message"') && /\n/.test(trimmed.trim())) {
    let content = "";
    let any = false;
    for (const line of text.split(/\r?\n/)) {
      const l = line.trim();
      if (!l) continue;
      try {
        const obj = JSON.parse(l) as { message?: { content?: string } };
        if (obj?.message?.content) {
          content += obj.message.content;
          any = true;
        }
      } catch {
        /* skip */
      }
    }
    if (any) return content;
  }
  try {
    const data = JSON.parse(trimmed) as { message?: { content?: string } };
    return data?.message?.content ?? extractContent(trimmed);
  } catch {
    return extractContent(trimmed);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 400);
  } catch {
    return "";
  }
}
