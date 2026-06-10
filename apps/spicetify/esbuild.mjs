// 构建 Spicetify 扩展：把 src/index.tsx 打成单文件 IIFE，
// 安装到 Spicetify 的 Extensions 目录，并可选 apply。
import { build, context } from "esbuild";
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dirname, "dist", "ai-lyrics.js");
const EXT_NAME = "ai-lyrics.js";

const watch = process.argv.includes("--watch");
const apply = process.argv.includes("--apply");
const dev = watch;

/** 取 Spicetify userdata 目录下的 Extensions 路径。 */
function extensionsDir() {
  try {
    const ud = execSync("spicetify path userdata", { encoding: "utf8" }).trim();
    if (ud) return join(ud, "Extensions");
  } catch {
    /* fall through */
  }
  return join(homedir(), ".config", "spicetify", "Extensions");
}

function installAndApply() {
  const dir = extensionsDir();
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    copyFileSync(OUT_FILE, join(dir, EXT_NAME));
    console.log(`[ai-lyrics] 已复制到 ${join(dir, EXT_NAME)}`);

    // 确保已注册（避免重复添加）。
    let current = "";
    try {
      current = execSync("spicetify config extensions", { encoding: "utf8" });
    } catch {
      /* ignore */
    }
    if (!current.includes(EXT_NAME)) {
      execSync(`spicetify config extensions ${EXT_NAME}`, { stdio: "inherit" });
      console.log("[ai-lyrics] 已注册扩展");
    }

    if (apply) {
      console.log("[ai-lyrics] spicetify apply（将重载 Spotify）…");
      execSync("spicetify apply", { stdio: "inherit" });
    }
  } catch (e) {
    console.error("[ai-lyrics] 安装/应用失败:", e?.message ?? e);
  }
}

/** 安装后置插件：每次构建结束后复制（并按需 apply）。 */
const installPlugin = {
  name: "install-to-spicetify",
  setup(b) {
    b.onEnd((result) => {
      if (result.errors.length === 0) installAndApply();
    });
  },
};

const options = {
  entryPoints: [join(__dirname, "src", "index.tsx")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome100"],
  jsx: "automatic",
  outfile: OUT_FILE,
  minify: !dev,
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
  loader: {
    ".glsl": "text", // 把 GLSL 着色器作为字符串内联（Kawarp 背景用）
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"),
  },
  plugins: [installPlugin],
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("[ai-lyrics] watch 中… 修改源码自动重建并安装。Ctrl+C 退出。");
} else {
  await build(options);
}
