// 本地 CORS 转发代理 —— 解决「内网/不支持 CORS 的 AI 端点无法从浏览器直连」。
//
// 浏览器（Spotify webview）→ http://localhost:11435 （本代理，补 CORS 头）
//                          → 你的真实端点（服务器到服务器，无 CORS 限制）
//
// 用法（TARGET 必填，填你自己的 OpenAI 兼容端点基址，到 /chat/completions 之前的部分）：
//   TARGET="https://api.openai.com/v1" node scripts/local-proxy.mjs
//   # 然后在扩展 ⚙ 设置里：Base URL 填  http://localhost:11435   （「经代理转发」保持关闭）
//   # API Key / 模型照常填；代理会原样透传 Authorization 头。
//
// 何时需要：你的 AI 端点不返回 Access-Control-Allow-Origin（浏览器直连被 CORS 拦）。
// 若用 LM Studio / Ollama 等本地端点（自带 CORS 或可开启），通常不需要本代理。
//
// 说明：http://localhost 在 Chromium 中视为安全上下文，https 页面可直接 fetch，不算混合内容。

import http from "node:http";
import { Readable } from "node:stream";

const PORT = Number(process.env.PORT || 11435);
// 上游端点基址（到 /chat/completions 之前的部分），通过 TARGET 环境变量提供。
const TARGET = (process.env.TARGET || "").replace(/\/+$/, "");
if (!TARGET) {
  console.error('请设置 TARGET，例如：TARGET="https://api.openai.com/v1" node scripts/local-proxy.mjs');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  // 统一补 CORS 头。注意：Authorization 不被 "*" 覆盖，需回显浏览器请求的头。
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    req.headers["access-control-request-headers"] || "Authorization, Content-Type",
  );
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks);

  // 路径透传：扩展请求 /chat/completions → 转发到 TARGET + /chat/completions
  const url = TARGET + req.url;
  const t0 = process.hrtime.bigint();
  const reqBytes = body.length;

  // 客户端（扩展）在响应完成前断开（切歌/强制刷新会立刻 abort）→ 取消上游请求。
  // 否则慢推理端点会把这条已废弃的请求继续跑完 80~125s，占用并发、阻塞新请求。
  const ac = new AbortController();
  let finished = false;
  res.on("close", () => {
    if (finished) return;
    ac.abort();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    console.log(`${req.method} ${req.url} -> 客户端断开，已取消上游 (${ms.toFixed(0)}ms)`);
  });

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        "content-type": req.headers["content-type"] || "application/json",
        ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}),
      },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      signal: ac.signal,
    });
    // 上游响应回来前客户端已断开：丢弃上游流，避免写已关闭的连接。
    if (res.writableEnded || res.destroyed) {
      try {
        await upstream.body?.cancel?.();
      } catch {
        /* ignore */
      }
      return;
    }
    const ct = upstream.headers.get("content-type") || "application/json";
    // 非 2xx：缓冲读取错误体并打印（排查 400/401/503 的具体原因），仍照常转发给客户端。
    if (upstream.status >= 400) {
      finished = true;
      const errText = await upstream.text().catch(() => "");
      if (!res.writableEnded && !res.destroyed) {
        res.writeHead(upstream.status, { "content-type": ct });
        res.end(errText);
      }
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      console.log(
        `${req.method} ${req.url} -> ${upstream.status} ${ms.toFixed(0)}ms 入${reqBytes}B [${ct}] 错误体: ${errText.replace(/\s+/g, " ").slice(0, 500)}`,
      );
      return;
    }
    res.writeHead(upstream.status, { "content-type": ct });
    // 流式透传：边到边发（SSE 才能在客户端增量渲染），不再缓冲整包。
    if (upstream.body) {
      const nodeStream = Readable.fromWeb(upstream.body);
      nodeStream.on("error", () => res.destroy());
      nodeStream.pipe(res);
      res.on("finish", () => {
        finished = true;
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        console.log(`${req.method} ${req.url} -> ${upstream.status} ${ms.toFixed(0)}ms 入${reqBytes}B [${ct}]`);
      });
    } else {
      finished = true;
      res.end();
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      console.log(`${req.method} ${req.url} -> ${upstream.status} ${ms.toFixed(0)}ms 入${reqBytes}B [${ct}]`);
    }
  } catch (e) {
    finished = true;
    if (e?.name === "AbortError") return; // 客户端断开导致的取消：静默
    if (!res.headersSent && !res.destroyed) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(e?.message ?? e) }));
    }
    console.error(`代理失败 ${url}:`, e?.message ?? e);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[local-proxy] http://localhost:${PORT}  →  ${TARGET}`);
  console.log(`扩展 Base URL 填： http://localhost:${PORT}`);
});
