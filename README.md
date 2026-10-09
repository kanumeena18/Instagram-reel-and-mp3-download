# ⚡ Instagram Media Downloader — Telegram Bot

A high-speed, professional Telegram Bot built with TypeScript, GrammY, yt-dlp, and FFmpeg that downloads media in **true maximum available quality** exclusively from **Instagram** (Reels, video posts, photos, carousels).

---

## ⚡ Key Highlights & Architecture

- **Instagram-Only Focus**:
  - Exclusively dedicated to public Instagram Reels, posts, and media.
  - Zero external platform clutter or bloat.
- **Direct Media Flow (No Metadata Message)**:
  - User sends an Instagram URL → bot validates → responds immediately → downloads highest practical quality → sends the media directly to the user → cleans up temporary files.
  - Completely eliminates metadata text messages (no username, likes, comments, views, captions, or codec info sent).
- **Much Better Video Quality**:
  - Always targets the best available video/audio stream with original resolution and bitrate.
  - Merges audio and video into standard playable MP4 where applicable.
  - Zero artificial downscaling or compression.
- **Fast Download Speed**:
  - Parallel multi-threaded fragment downloads (`--concurrent-fragments 5`).
  - Optimized network buffer and chunk sizes (`10MB chunks`, `1MB buffer`).
  - Streamlined single-pass extraction.
- **Instant Response & Short Processing Status**:
  - Responds within milliseconds: `"⚡ Link received. Preparing your download..."`
  - Updates status during processing.
- **Genuine File-Size Handling**:
  - The application never downscales or rejects files based on a hardcoded 50 MB limit.
  - Automatically attempts upload using the maximum capability of the connected Telegram API server.
  - Transparently reports the actual Telegram server response if the public cloud limit is reached.
  - Full native support for self-hosted Telegram Local Bot API servers for uploads up to **2,000 MB (2 GB)**!
- **Automatic Storage Cleanup**:
  - Temporary download files are immediately unlinked from the server in guaranteed `finally` blocks.

---

## 📦 Telegram API Upload Limits: How It Works & How to Unlock 2 GB

Telegram's upload limits depend strictly on which API server endpoint the bot connects to:

| Mode | Endpoint | Max File Size | How to Enable |
|---|---|---|---|
| **Telegram Public Cloud API** | `https://api.telegram.org` (Default) | **50 MB** | Enabled by default |
| **Telegram Local Bot API Server** | `http://localhost:8081` | **2,000 MB (2 GB)** | Set `TELEGRAM_API_ROOT` in `.env` |

### Unlocking 2,000 MB (2 GB) Uploads with Telegram Local Bot API Server

1. Telegram provides an open-source local server: [`telegram-bot-api`](https://core.telegram.org/bots/api#using-a-local-bot-api-server).
2. Run it via Docker (or build from source):
   ```bash
   docker run -d -p 8081:8081 --name telegram-bot-api \
     -v telegram-bot-api-data:/var/lib/telegram-bot-api \
     aiogram/telegram-bot-api:latest \
     --api-id=YOUR_TELEGRAM_API_ID \
     --api-hash=YOUR_TELEGRAM_API_HASH \
     --local
   ```
3. In your `.env` file, specify:
   ```env
   TELEGRAM_API_ROOT="http://localhost:8081"
   ```
4. Now the bot can upload files up to 2 GB with zero code changes.

---

## 🛠️ Requirements & Installation

1. **Node.js 18+**
2. **FFmpeg** (installed on system PATH)
3. **yt-dlp** (installed on system PATH or in `bin/`)

```bash
npm install
```

Configure `.env`:
```env
BOT_TOKEN="your_telegram_bot_token_from_botfather"
# Optional:
TELEGRAM_API_ROOT="https://api.telegram.org"
```

---

## 🚀 Running the Bot

### Standalone Bot (CLI)
```bash
npm run bot
```

### Full-Stack (Web Dashboard + Simulator + Runner)
```bash
npm run dev
```
Navigate to `http://localhost:3000`.

---

## 💬 User Experience

```text
/start
↓
Welcome to Instagram Media Downloader ⚡

Send an Instagram Reel or post link and I'll download the media in the highest available quality.

Fast • High Quality • Simple

Just paste your Instagram link to get started.
↓
User sends: https://www.instagram.com/reel/C8q43Z_Mxxx/
↓
⚡ Link received. Preparing your download...
↓
[Media delivered directly to user]
↓
Done
```
