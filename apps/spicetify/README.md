# @ai-lyrics/spicetify

The Spicetify extension (Spotify desktop client) for **ai-lyrics**.
See the [root README](../../README.md) ([简体中文](../../README_zh.md)) for the full project overview, AI setup, model recommendations and performance notes.

## Usage

```bash
# from the repo root
pnpm install

# build + install into Spicetify + apply (reloads Spotify)
pnpm --filter @ai-lyrics/spicetify apply

# develop: watch-rebuild and auto install/apply
pnpm --filter @ai-lyrics/spicetify dev
```

In Spotify:

- Click the **AI Lyrics** button in the playbar, or press `Cmd/Ctrl + Shift + L`, to toggle the lyrics page; `Esc` exits.
- The page scrolls full-width in sync with playback; **click any line** or **drag the bottom progress bar** to seek.
- Each line shows AI translation / keywords / grammar / examples inline (configure AI in ⚙ Settings).

## AI configuration

⚙ → pick a provider:

- **OpenAI-compatible**: Base URL / API Key / model — works with LM Studio, Ollama's `/v1`, OpenAI, OpenRouter, vLLM, etc. Recommended path: a local **LM Studio** server (see root README).
- **Ollama**: native `/api/chat`; set `OLLAMA_ORIGINS="*"` so the browser can reach it.

## Uninstall

```bash
spicetify config extensions ai-lyrics.js-   # unregister
spicetify apply
# or fully restore: spicetify restore
```
