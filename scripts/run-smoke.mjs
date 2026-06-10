// 运行核心逻辑的 headless 冒烟测试（scripts/smoke.ts）。
// 用 esbuild 打包 + 内联执行；通过 tsconfig.base.json 的 paths 解析 @ai-lyrics/* 到各包源码。
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const r = await build({
  entryPoints: [join(root, "scripts", "smoke.ts")],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
  tsconfig: join(root, "tsconfig.base.json"), // 让 esbuild 按 paths 解析 @ai-lyrics/*
  external: ["react", "react-dom"],
});
await import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
