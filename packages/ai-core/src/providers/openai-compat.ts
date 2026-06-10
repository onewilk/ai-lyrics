import {
  buildBatchSystemPrompt,
  buildBatchUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  makeStreamLineEmitter,
  parseAnalysis,
  parseBatchAnalysis,
} from "../prompt.js";
import { extractContent, readContentStream } from "../stream.js";
import type { AiProvider, AnalyzeInput, BatchAnalyzeContext, LineAnalysis } from "../types.js";

export { extractContent };

export interface OpenAiCompatOptions {
  /** 形如 https://api.openai.com/v1 ；也兼容本地 vLLM、OpenRouter、深度求索等。 */
  baseUrl?: string;
  apiKey?: string;
  /** 候选模型（按序 fallback），至少一个。 */
  models?: string[];
  fetchImpl?: typeof fetch;
  /** 免预检模式：不发 Authorization 与自定义 Content-Type 以跳过 CORS 预检。 */
  simpleRequest?: boolean;
  /** 是否流式（请求 stream:true 并增量解析）。 */
  streaming?: boolean;
  /** 关闭深度思考/推理：请求带上多种主流关闭字段（网关只取认识的、忽略其余）。 */
  disableThinking?: boolean;
}

/**
 * 「关闭深度思考」的常见请求字段集合——主流网关各用各的，全带上覆盖面最大；
 * 网关一般忽略不认识的字段，只有少数严格网关会 400（此时 completeOne 会逐级回退）。
 * 选取覆盖用户实际端点的两大家族：DeepSeek（chat_template_kwargs.thinking）、
 * 通义/Qwen（enable_thinking），外加通用的 reasoning_effort。
 */
const NO_THINK_PARAMS: Record<string, unknown> = {
  enable_thinking: false,
  reasoning_effort: "none",
  chat_template_kwargs: { thinking: false, enable_thinking: false },
};

export class OpenAiCompatProvider implements AiProvider {
  readonly id = "openai";
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly models: string[];
  private readonly fetchImpl: typeof fetch;
  private readonly simple: boolean;
  private readonly streaming: boolean;
  private readonly noThink: boolean;

  constructor(opts: OpenAiCompatOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.apiKey = opts.apiKey ?? "";
    this.models = (opts.models ?? ["gpt-4o-mini"]).filter(Boolean);
    if (this.models.length === 0) this.models = ["gpt-4o-mini"];
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.simple = opts.simpleRequest ?? false;
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

  /** 依次尝试候选模型（失败 fallback），返回助手内容。 */
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
        try {
          console.warn(`[ai-lyrics] 模型 ${model} 失败，尝试下一个：`, (e as Error)?.message ?? e);
        } catch {
          /* ignore */
        }
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
    // 逐级回退（仅 400/422 这类「参数不被接受」才换组合；其余错误如 401/5xx 立即抛）。
    // [jsonFormat, noThink]：先尽量带上 response_format + 关思考字段；不行就分别去掉。
    // 失败的尝试都是网关参数校验的「秒拒」，不会耗模型时间，故多试无妨。
    const combos: Array<[boolean, boolean]> = this.noThink
      ? [
          [true, true],
          [false, true], // 可能是 response_format 不被接受，保留关思考
          [false, false], // 最兼容：两者都去掉（此时思考可能恢复）
        ]
      : [
          [true, false],
          [false, false],
        ];

    let res: Response | null = null;
    for (const [jsonFormat, noThink] of combos) {
      res = await this.request(system, user, model, jsonFormat, noThink, signal);
      if (res.ok) break;
      if (res.status !== 400 && res.status !== 422) break;
    }
    if (!res || !res.ok) throw new Error(`OpenAI-compat ${res?.status ?? "?"}: ${res ? await safeText(res) : ""}`);
    if (this.streaming && onProgress) return readContentStream(res, onProgress, signal);
    return extractContent(await res.text());
  }

  private request(
    system: string,
    user: string,
    model: string,
    jsonFormat: boolean,
    noThink: boolean,
    signal?: AbortSignal,
  ): Promise<Response> {
    const body: Record<string, unknown> = {
      model,
      temperature: 0.2,
      max_tokens: 8192,
      stream: this.streaming,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    };
    if (jsonFormat) body.response_format = { type: "json_object" };
    if (noThink) Object.assign(body, NO_THINK_PARAMS);

    if (this.simple) {
      return this.fetchImpl(this.endpoint(), { method: "POST", signal, body: JSON.stringify(body) });
    }
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return this.fetchImpl(this.endpoint(), {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify(body),
    });
  }

  /** 容错地拼出 chat/completions 端点：baseUrl 已含该后缀则不重复追加。 */
  private endpoint(): string {
    const base = this.baseUrl.replace(/\/+$/, "");
    return /\/chat\/completions$/.test(base) ? base : `${base}/chat/completions`;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 400);
  } catch {
    return "";
  }
}
