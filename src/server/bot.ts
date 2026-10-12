import { Bot, InputFile } from 'grammy';
import fs from 'fs';
import path from 'path';
import {
  AudioExtractionResult,
  detectPlatform,
  downloadMedia,
  extractAudioFromVideo,
  extractUrl,
  formatBytes,
  formatDuration,
  ProgressData,
  renderProgressBar,
  stripInternalPaths,
} from './downloader';
import {
  getCachedMedia,
  storeMediaInCache,
  runSingleFlight,
  normalizeInstagramUrl,
} from './cache';

export interface BotLogEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'download' | 'error' | 'success' | 'timing';
  message: string;
}

export interface BotState {
  isRunning: boolean;
  botUsername?: string;
  botId?: number;
  totalProcessed: number;
  successfulDownloads: number;
  failedDownloads: number;
  activeDownloads: number;
  startedAt?: string;
  isUsingLocalBotApi: boolean;
  activeApiRoot: string;
  logs: BotLogEvent[];
}

const defaultApiRoot = process.env.TELEGRAM_API_ROOT?.trim() || 'https://api.telegram.org';
const isConfiguredLocalBotApi = !defaultApiRoot.includes('api.telegram.org');

export const botState: BotState = {
  isRunning: false,
  totalProcessed: 0,
  successfulDownloads: 0,
  failedDownloads: 0,
  activeDownloads: 0,
  isUsingLocalBotApi: isConfiguredLocalBotApi,
  activeApiRoot: defaultApiRoot,
  logs: [],
};

export const WELCOME_MESSAGE = `Welcome to Instagram Media Downloader ⚡

Send an Instagram Reel or post link and I'll download the media in the highest available quality.

Fast • High Quality • Simple

Just paste your Instagram link to get started.`;

export function addBotLog(type: BotLogEvent['type'], message: string) {
  const event: BotLogEvent = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString(),
    type,
    message,
  };
  botState.logs.unshift(event);
  if (botState.logs.length > 50) {
    botState.logs.pop();
  }
}

let activeBotInstance: Bot | null = null;

// Build Telegram bot handlers with custom or standard API Root
export function createTelegramBot(token: string): Bot {
  const apiRoot = process.env.TELEGRAM_API_ROOT?.trim() || undefined;
  const isLocal = Boolean(apiRoot && !apiRoot.includes('api.telegram.org'));

  botState.isUsingLocalBotApi = isLocal;
  botState.activeApiRoot = apiRoot || 'https://api.telegram.org';

  const bot = new Bot(token, {
    client: {
      apiRoot,
    },
  });

  // /start command
  bot.command('start', async (ctx) => {
    addBotLog('info', `User @${ctx.from?.username || ctx.from?.id} started the bot`);
    await ctx.reply(WELCOME_MESSAGE);
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `Instagram Media Downloader ⚡

Send any Instagram Reel or post link and I'll download the media in the highest available quality.

Fast • High Quality • Simple

Just paste your Instagram link to get started.`
    );
  });

  // Handle incoming text messages
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();

    // Check for start command if sent without leading slash
    if (text.toLowerCase() === 'start') {
      await ctx.reply(WELCOME_MESSAGE);
      return;
    }

    const url = extractUrl(text);

    // If no URL is found
    if (!url) {
      await ctx.reply(WELCOME_MESSAGE);
      return;
    }

    // Check Instagram platform
    const platform = detectPlatform(url);
    if (!platform) {
      addBotLog('error', `Unsupported link from @${ctx.from?.username || ctx.from?.id}: ${url.substring(0, 50)}...`);
      await ctx.reply("❌ Unsupported link. Please send a valid Instagram URL.");
      return;
    }

    // Processing supported Instagram URL
    botState.totalProcessed++;
    botState.activeDownloads++;
    addBotLog('download', `Started download for @${ctx.from?.username || ctx.from?.id}`);

    const tStart = performance.now();
    let statusMsg: any = null;
    try {
      statusMsg = await ctx.reply("⚡ Link received. Preparing your download...");
    } catch {
      // Ignore initial message error
    }

    try {
      // 1. FAST PATH: Check Smart Cache for instant reuse (< 1.5s total delivery)
      const cached = getCachedMedia(url);
      if (cached) {
        console.log(`⚡ [Cache Hit] Reusing valid cached media for: ${url}`);
        addBotLog('success', `Cache hit for @${ctx.from?.username || ctx.from?.id} (${cached.videoSizeMB.toFixed(1)} MB)`);

        const creatorStr = cached.uploader || 'Instagram Creator';
        const mediaCaption = `🎬 Video by ${creatorStr}\n📺 ${cached.resolution} · ${cached.videoSizeMB.toFixed(1)} MB`;

        const tVidStart = performance.now();
        await ctx.replyWithVideo(new InputFile(cached.videoFilePath), {
          caption: mediaCaption,
          supports_streaming: true,
        });
        const tFirstFileSent = performance.now();
        const videoUploadMs = tFirstFileSent - tVidStart;

        let audioUploadMs = 0;
        if (cached.mp3FilePath && fs.existsSync(cached.mp3FilePath)) {
          const tAudStart = performance.now();
          try {
            await ctx.replyWithAudio(new InputFile(cached.mp3FilePath, cached.mp3FileName), {
              caption: `🎵 Audio — MP3\n320 kbps`,
              title: cached.title || 'Instagram Audio',
              performer: creatorStr,
            });
            audioUploadMs = performance.now() - tAudStart;
          } catch (audioErr: any) {
            addBotLog('error', `Failed to send cached MP3: ${audioErr.message}`);
          }
        }

        if (statusMsg) {
          ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        }

        botState.successfulDownloads++;
        botState.activeDownloads = Math.max(0, botState.activeDownloads - 1);

        const tTotal = performance.now() - tStart;
        const firstFileMs = tFirstFileSent - tStart;
        console.log(`⚡ [TIMING - CACHE HIT] Link: ${url.substring(0, 40)} | VideoUpload: ${Math.round(videoUploadMs)}ms | AudioUpload: ${Math.round(audioUploadMs)}ms | FirstFile: ${Math.round(firstFileMs)}ms | Total: ${Math.round(tTotal)}ms`);
        addBotLog('timing', `⚡ Cache hit: First file in ${(firstFileMs / 1000).toFixed(1)}s, total ${(tTotal / 1000).toFixed(1)}s`);
        return;
      }

      // 2. FRESH DOWNLOAD: SingleFlight deduplication ensures identical simultaneous URLs are only fetched once
      const normUrl = normalizeInstagramUrl(url);

      const downloadResult = await downloadMedia(url);
      const tDownloadDone = performance.now();
      const downloadMs = tDownloadDone - tStart;

      const resolutionStr = downloadResult.verification?.resolution || 'Original Quality';
      const creatorStr = downloadResult.uploader || 'Instagram Creator';
      const mediaCaption = `🎬 Video by ${creatorStr}\n📺 ${resolutionStr} · ${downloadResult.fileSizeMB.toFixed(1)} MB`;

      // 3. ULTRA-FAST CONCURRENCY:
      // Start Video upload immediately the millisecond the video is on disk.
      // Simultaneously, run FFmpeg multi-core MP3 extraction in the background.
      let tFirstFileSent = 0;
      let videoUploadMs = 0;
      let mp3Ms = 0;

      // Pipeline A: Video Upload to Telegram
      const videoUploadPromise = (async () => {
        const tVidStart = performance.now();
        try {
          await ctx.replyWithVideo(new InputFile(downloadResult.filePath), {
            caption: mediaCaption,
            supports_streaming: true,
          });
        } catch (videoUploadErr: any) {
          const rawErr = (videoUploadErr.description || videoUploadErr.message || '').toString();
          const isSizeLimitation =
            rawErr.toLowerCase().includes('file is too big') ||
            rawErr.toLowerCase().includes('entity too large') ||
            rawErr.toLowerCase().includes('file_parts_too_much') ||
            rawErr.includes('413') ||
            (!botState.isUsingLocalBotApi && downloadResult.fileSizeMB > 50 && (rawErr.includes('Bad Request') || rawErr.includes('400')));

          if (!isSizeLimitation) {
            // Fallback to document
            await ctx.replyWithDocument(new InputFile(downloadResult.filePath, downloadResult.fileName), {
              caption: mediaCaption,
            });
          } else {
            throw videoUploadErr;
          }
        }
        tFirstFileSent = performance.now();
        videoUploadMs = tFirstFileSent - tVidStart;
      })();

      // Pipeline B: Concurrent High-Speed 320 kbps MP3 Extraction
      const mp3ExtractionPromise = (async () => {
        const tMp3Start = performance.now();
        try {
          const res = await extractAudioFromVideo(
            downloadResult.filePath,
            downloadResult.id,
            creatorStr
          );
          mp3Ms = performance.now() - tMp3Start;
          return res;
        } catch (audioErr: any) {
          addBotLog('error', `MP3 extraction failed: ${audioErr.message}`);
          return null;
        }
      })();

      // Wait for Video Upload to complete
      await videoUploadPromise;

      // Wait for MP3 Extraction to complete (already finished or just finishing)
      const mp3Result = await mp3ExtractionPromise;

      // 4. Send MP3 immediately
      let audioUploadMs = 0;
      if (mp3Result) {
        const tAudStart = performance.now();
        try {
          await ctx.replyWithAudio(new InputFile(mp3Result.filePath, mp3Result.fileName), {
            caption: `🎵 Audio — MP3\n320 kbps`,
            title: downloadResult.title || 'Instagram Audio',
            performer: creatorStr,
          });
          audioUploadMs = performance.now() - tAudStart;
        } catch (audioSendErr: any) {
          addBotLog('error', `Failed to send MP3 audio: ${audioSendErr.message}`);
          await ctx.reply("⚠️ Video downloaded, but MP3 could not be sent.");
        }
      }

      // Store in smart cache for immediate reuse by duplicate requests
      await storeMediaInCache(url, downloadResult, mp3Result || undefined);

      // Clean up temporary status message
      if (statusMsg) {
        ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
      }

      // Clean up temporary working files (the cache preserves persistent copies)
      await downloadResult.cleanup().catch(() => {});
      if (mp3Result) {
        await mp3Result.cleanup().catch(() => {});
      }

      botState.successfulDownloads++;
      botState.activeDownloads = Math.max(0, botState.activeDownloads - 1);

      const tTotal = performance.now() - tStart;
      const firstFileMs = tFirstFileSent ? (tFirstFileSent - tStart) : downloadMs;

      console.log(`⚡ [TIMING] Link: ${url.substring(0, 40)} | Download: ${Math.round(downloadMs)}ms | MP3: ${Math.round(mp3Ms)}ms | VideoUpload: ${Math.round(videoUploadMs)}ms | AudioUpload: ${Math.round(audioUploadMs)}ms | FirstFile: ${Math.round(firstFileMs)}ms | Total: ${Math.round(tTotal)}ms`);
      addBotLog('timing', `⚡ Ultra-Fast: First file in ${(firstFileMs / 1000).toFixed(1)}s, total ${(tTotal / 1000).toFixed(1)}s`);
      addBotLog('success', `Sent media (${downloadResult.fileSizeMB.toFixed(1)}MB) + MP3 to @${ctx.from?.username || ctx.from?.id}`);
    } catch (err: any) {
      botState.failedDownloads++;
      botState.activeDownloads = Math.max(0, botState.activeDownloads - 1);
      const cleanMsg = stripInternalPaths(err.message || 'Unable to process this link.');
      addBotLog('error', `Failed to download: ${cleanMsg}`);

      const userErrorMessage = `❌ Download Failed\n\n${cleanMsg}`;
      if (statusMsg) {
        try {
          await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, userErrorMessage);
        } catch {
          await ctx.reply(userErrorMessage);
        }
      } else {
        await ctx.reply(userErrorMessage);
      }
    }
  });

  return bot;
}

// Start Telegram Bot
export async function startBot(token: string): Promise<{ success: boolean; botInfo?: any; error?: string }> {
  try {
    if (activeBotInstance) {
      try {
        await activeBotInstance.stop();
      } catch {
        // Ignore previous stop errors
      }
    }

    const bot = createTelegramBot(token);
    const botInfo = await bot.api.getMe();

    botState.isRunning = true;
    botState.botUsername = botInfo.username;
    botState.botId = botInfo.id;
    botState.startedAt = new Date().toISOString();
    activeBotInstance = bot;

    addBotLog('info', `Bot started successfully as @${botInfo.username}`);

    bot.start({
      onStart: (info) => {
        addBotLog('info', `Polling started for @${info.username}`);
      },
    }).catch((err) => {
      botState.isRunning = false;
      addBotLog('error', `Bot polling error: ${err.message}`);
    });

    return {
      success: true,
      botInfo: {
        id: botInfo.id,
        username: botInfo.username,
        firstName: botInfo.first_name,
        canJoinGroups: botInfo.can_join_groups,
      },
    };
  } catch (err: any) {
    botState.isRunning = false;
    const msg = err.message || 'Failed to authenticate Telegram bot token';
    addBotLog('error', `Login failed: ${msg}`);
    return {
      success: false,
      error: msg,
    };
  }
}

// Stop Telegram Bot
export async function stopBot(): Promise<boolean> {
  if (activeBotInstance) {
    try {
      await activeBotInstance.stop();
      activeBotInstance = null;
      botState.isRunning = false;
      addBotLog('info', 'Bot stopped by user');
      return true;
    } catch (err: any) {
      addBotLog('error', `Error stopping bot: ${err.message}`);
      return false;
    }
  }
  botState.isRunning = false;
  return true;
}

// Simulation logic for web UI testing without bot token
export interface SimulationResponse {
  steps: Array<{
    type: 'text' | 'media';
    text?: string;
    mediaUrl?: string;
    title?: string;
    platform?: string;
    sizeMB?: number;
    duration?: string;
    resolution?: string;
  }>;
}

export async function simulateBotResponse(userMessage: string): Promise<SimulationResponse> {
  const text = userMessage.trim();

  // 1. /start command
  if (text === '/start' || text.toLowerCase() === 'start') {
    return {
      steps: [
        {
          type: 'text',
          text: WELCOME_MESSAGE,
        },
      ],
    };
  }

  // 2. /help command
  if (text === '/help' || text.toLowerCase() === 'help') {
    return {
      steps: [
        {
          type: 'text',
          text: `Instagram Media Downloader ⚡\n\nSend an Instagram Reel or post link and I'll download the media in the highest available quality.\n\nFast • High Quality • Simple\n\nJust paste your Instagram link to get started.`,
        },
      ],
    };
  }

  const url = extractUrl(text);

  // 3. No URL found
  if (!url) {
    return {
      steps: [
        {
          type: 'text',
          text: WELCOME_MESSAGE,
        },
      ],
    };
  }

  // 4. Unsupported URL
  const platform = detectPlatform(url);
  if (!platform) {
    return {
      steps: [
        {
          type: 'text',
          text: "❌ Unsupported link. Please send a valid Instagram URL.",
        },
      ],
    };
  }

  // 5. Valid Instagram URL processing
  try {
    // Check cache first for instant simulator preview
    const cached = getCachedMedia(url);
    if (cached) {
      const creatorStr = cached.uploader || 'Instagram Creator';
      const steps: SimulationResponse['steps'] = [
        { type: 'text', text: "⚡ Link received. Preparing your download..." },
        { type: 'text', text: `✅ Cache hit (${cached.videoSizeMB.toFixed(1)} MB). Instant delivery!` },
      ];

      steps.push({
        type: 'media',
        mediaUrl: `/api/media/file/${encodeURIComponent(cached.videoFileName)}`,
        platform: 'instagram',
        title: `🎬 Video by ${creatorStr}\n📺 ${cached.resolution} · ${cached.videoSizeMB.toFixed(1)} MB`,
        sizeMB: Number(cached.videoSizeMB.toFixed(1)),
        duration: formatDuration(cached.duration),
        resolution: cached.resolution,
      });

      if (cached.mp3FileName) {
        steps.push({
          type: 'media',
          mediaUrl: `/api/media/file/${encodeURIComponent(cached.mp3FileName)}`,
          platform: 'instagram',
          title: `🎵 Audio — MP3\n320 kbps (${creatorStr})`,
          sizeMB: cached.mp3SizeMB ? Number(cached.mp3SizeMB.toFixed(1)) : undefined,
          duration: formatDuration(cached.duration),
          resolution: '320 kbps MP3',
        });
      }

      return { steps };
    }

    const download = await downloadMedia(url);
    let mp3Result: AudioExtractionResult | null = null;

    try {
      try {
        mp3Result = await extractAudioFromVideo(
          download.filePath,
          download.id,
          download.uploader || download.title
        );
      } catch {
        // Continue even if audio extraction encounters an issue
      }

      // Store in persistent cache so streaming endpoint can serve it directly
      await storeMediaInCache(url, download, mp3Result || undefined);

      const resBadge = download.verification?.resolution || 'Highest Quality';
      const creatorStr = download.uploader || 'Instagram Creator';

      const steps: SimulationResponse['steps'] = [
        { type: 'text', text: "⚡ Link received. Preparing your download..." },
        { type: 'text', text: `✅ Download complete (${download.fileSizeMB.toFixed(1)} MB). Sending media...` },
      ];

      if (download.fileSizeMB > 50 && !botState.isUsingLocalBotApi) {
        steps.push({
          type: 'text',
          text:
`ℹ️ Telegram Server Note:
This file is ${download.fileSizeMB.toFixed(1)} MB. The public Telegram Cloud Bot API server (api.telegram.org) limits bot uploads to 50 MB.
To upload files up to 2,000 MB (2 GB) in Telegram, use Telegram's Local Bot API server (set TELEGRAM_API_ROOT in .env).
In this web simulator, you can watch and download the full uncompressed media right here!`,
        });
      }

      // Stream media without buffering whole files into RAM
      steps.push({
        type: 'media',
        mediaUrl: `/api/media/file/${encodeURIComponent(download.fileName)}`,
        platform: 'instagram',
        title: `🎬 Video by ${creatorStr}\n📺 ${resBadge} · ${download.fileSizeMB.toFixed(1)} MB`,
        sizeMB: Number(download.fileSizeMB.toFixed(1)),
        duration: formatDuration(download.duration),
        resolution: resBadge,
      });

      if (mp3Result) {
        steps.push({
          type: 'media',
          mediaUrl: `/api/media/file/${encodeURIComponent(mp3Result.fileName)}`,
          platform: 'instagram',
          title: `🎵 Audio — MP3\n320 kbps (${creatorStr})`,
          sizeMB: Number(mp3Result.fileSizeMB.toFixed(1)),
          duration: formatDuration(download.duration),
          resolution: '320 kbps MP3',
        });
      }

      return { steps };
    } finally {
      // Clean up the working directory files (persistent copies are kept in temp/cache/)
      await download.cleanup().catch(() => {});
      if (mp3Result) {
        await mp3Result.cleanup().catch(() => {});
      }
    }
  } catch (err: any) {
    const cleanMsg = stripInternalPaths(err.message || 'Network or media error.');
    return {
      steps: [
        { type: 'text', text: "⚡ Link received. Preparing your download..." },
        {
          type: 'text',
          text: `❌ Error processing media: ${cleanMsg}`,
        },
      ],
    };
  }
}
