#!/bin/bash
# 以「关闭网页安全策略」方式启动 Spotify，绕过浏览器 CORS。
# 适用场景：你的 AI 端点不返回 Access-Control-Allow-Origin，浏览器读不到响应。
# 注意：多数情况更推荐用本地代理（scripts/local-proxy.mjs）或自带 CORS 的本地端点
#       （LM Studio / Ollama），无需关闭浏览器安全策略。
#
# ⚠️ 代价与风险：
#   - 该 Spotify 实例【全局关闭同源策略】，安全性下降（仅自用、临时使用）。
#   - 使用独立配置目录，首次启动需要重新登录一次 Spotify。
#   - Spicetify 的注入是改 app 包文件，与配置目录无关，所以扩展照常加载。
#
# 用法：bash scripts/launch-spotify-nocors.sh

set -e
APP="/Applications/Spotify.app/Contents/MacOS/Spotify"
DIR="$HOME/.spotify-nocors"

if [ ! -x "$APP" ]; then
  echo "未找到 Spotify: $APP"; exit 1
fi

echo "关闭现有 Spotify…"
killall Spotify 2>/dev/null || true
sleep 1

echo "以 --disable-web-security 启动（独立配置目录: $DIR，首次需登录）…"
"$APP" --disable-web-security --user-data-dir="$DIR" >/dev/null 2>&1 &

echo "已启动。进入后："
echo "  1) 播放栏字幕图标打开面板；"
echo "  2) ⚙ 设置：Base URL 填你自己的 OpenAI 兼容端点（如 https://api.openai.com/v1）"
echo "     填好 API Key 与模型；「免预检请求」「经 Spicetify 代理转发」都【关闭】；"
echo "  3) Cmd+R 刷新后播放测试。"
