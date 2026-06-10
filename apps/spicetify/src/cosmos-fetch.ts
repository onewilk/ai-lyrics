/**
 * 用 `Spicetify.CosmosAsync` 实现一个 fetch 适配器。
 *
 * 为什么需要它：Spicetify 扩展跑在 Spotify 的 webview 里，直接 `fetch` 外部
 * AI 端点（OpenAI 兼容、甚至本机 Ollama）会被浏览器 CORS/CSP 拦下，表现为
 * "Failed to fetch"。CosmosAsync 是 Spotify 的原生网络客户端，不受 CORS/CSP
 * 限制（参考插件 genius/lucid 都用它访问外部 API）。
 *
 * 仅在 Spicetify 注入给 ai-core 的 provider；ai-core 本身保持宿主无关。
 */
export function makeCosmosFetch(): typeof fetch {
  const impl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = normalizeHeaders(init?.headers);

    let body: unknown;
    if (init?.body != null) {
      const raw = init.body as string;
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }

    const cosmos = (window as unknown as { Spicetify?: { CosmosAsync?: any } }).Spicetify?.CosmosAsync;
    if (!cosmos) throw new TypeError("CosmosAsync 不可用");

    const fn = cosmos[method.toLowerCase()] ?? cosmos.get;
    // 埋点：CosmosAsync 往返总耗时（= 它自身开销 + 真实请求）。与本地代理日志的「端点耗时」
    // 对比即可判断慢在哪：两者≈→端点慢；这里明显更大→CosmosAsync/其转发路径慢。
    const t0 = performance.now();
    const ms = () => (performance.now() - t0).toFixed(0);
    try {
      // CosmosAsync 偶发不返回（外部端点）；加超时与中止，避免永久卡在“解析中”。
      const data = await withTimeoutAndAbort(
        fn.call(cosmos, url, body, headers),
        init?.signal,
        TIMEOUT_MS,
      );
      // eslint-disable-next-line no-console
      console.log(`[ai-lyrics] CosmosAsync ${method} 往返 ${ms()}ms ← ${url}`);
      const text = typeof data === "string" ? data : JSON.stringify(data);
      return makeResponse(200, text);
    } catch (e: unknown) {
      if ((e as Error)?.name === "AbortError") {
        // eslint-disable-next-line no-console
        console.log(`[ai-lyrics] CosmosAsync ${method} 取消于 ${ms()}ms`);
        throw e; // 取消：交由上层忽略
      }
      const msg = String((e as Error)?.message ?? e);
      // eslint-disable-next-line no-console
      console.warn(`[ai-lyrics] CosmosAsync ${method} 失败于 ${ms()}ms: ${msg.slice(0, 200)}`);
      const matched = Number(msg.match(/\b(\d{3})\b/)?.[1]);
      const status = matched || (msg.includes("超时") ? 504 : 502);
      return makeResponse(status, msg);
    }
  };
  return impl as unknown as typeof fetch;
}

const TIMEOUT_MS = 30000;

function withTimeoutAndAbort<T>(p: Promise<T>, signal: AbortSignal | null | undefined, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`CosmosAsync 请求超时(${ms / 1000}s)`)), ms);
    const onAbort = () => {
      clearTimeout(to);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
    p.then(
      (v) => {
        clearTimeout(to);
        signal?.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e) => {
        clearTimeout(to);
        signal?.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

function normalizeHeaders(h?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (typeof Headers !== "undefined" && h instanceof Headers) {
    h.forEach((v, k) => (out[k] = v));
  } else if (Array.isArray(h)) {
    for (const [k, v] of h) out[k] = v;
  } else {
    Object.assign(out, h);
  }
  return out;
}

/** 仅实现 ai-core provider 用到的 Response 字段（ok/status/json/text）。 */
function makeResponse(status: number, text: string): Response {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    async json() {
      return JSON.parse(text);
    },
    async text() {
      return text;
    },
  } as Response;
}
