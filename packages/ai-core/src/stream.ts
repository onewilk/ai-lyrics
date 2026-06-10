interface ChatChoice {
  message?: { content?: string };
  delta?: { content?: string };
}

/** 从响应文本提取助手内容：兼容单个 JSON 与 SSE 流（data: {chunk} 多行）。 */
export function extractContent(text: string): string {
  const trimmed = text.trimStart();

  if (trimmed.startsWith("data:")) {
    let content = "";
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^data:\s*(.*)$/);
      if (!m) continue;
      const payload = m[1].trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload) as { choices?: ChatChoice[] };
        const choice = obj?.choices?.[0];
        content += choice?.delta?.content ?? choice?.message?.content ?? "";
      } catch {
        /* 跨行被截断的 chunk：跳过 */
      }
    }
    return content;
  }

  try {
    const data = JSON.parse(trimmed) as { choices?: ChatChoice[] };
    const choice = data?.choices?.[0];
    return choice?.message?.content ?? choice?.delta?.content ?? "";
  } catch {
    return "";
  }
}

/**
 * 读取（可能为 SSE 流的）Response：
 * - 流式：逐行解析 `data: {chunk}`，累积 delta.content，每次累积后回调 onProgress(完整内容)。
 * - 非流式或无可读流：退回一次性 text() 解析。
 * 返回最终完整的助手内容字符串。
 */
export async function readContentStream(
  res: Response,
  onProgress: (fullContentSoFar: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const body = (res as unknown as { body?: ReadableStream<Uint8Array> }).body;
  const reader = body?.getReader?.();
  if (!reader) {
    const content = extractContent(await res.text());
    if (content) onProgress(content);
    return content;
  }

  const decoder = new TextDecoder();
  let buf = "";
  let raw = "";
  let full = "";

  const handleLine = (line: string) => {
    const t = line.trim();
    if (!t.startsWith("data:")) return;
    const payload = t.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const obj = JSON.parse(payload) as { choices?: ChatChoice[] };
      const choice = obj?.choices?.[0];
      const piece = choice?.delta?.content ?? choice?.message?.content ?? "";
      if (piece) {
        full += piece;
        onProgress(full);
      }
    } catch {
      /* 不完整/非 JSON 的 data 行：跳过 */
    }
  };

  for (;;) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => {});
      break;
    }
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    raw += chunk;
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      handleLine(line);
    }
  }
  if (buf) handleLine(buf);

  if (!full) {
    full = extractContent(raw);
    if (full) onProgress(full);
  }
  return full;
}
