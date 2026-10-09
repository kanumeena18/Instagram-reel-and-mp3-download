import { Bot, InputFile } from 'grammy';
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
} from './downloader';

export interface BotLogEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'download' | 'error' | 'success';
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

    // Fast Immediate Response
    let statusMsg: any = null;
    try {
      statusMsg = await ctx.reply("⚡ Link received. Preparing your download...");
    } catch {
      // Ignore initial message error
    }

    let lastEditTime = 0;

    try {
      // 1. Download highest practical quality video
      const downloadResult = await downloadMedia(url, {
        onProgress: async (progress: ProgressData) => {
          const now = Date.now();
          // Throttle edits to once every 1600ms to stay within Telegram rate limits
          if (statusMsg && (now - lastEditTime >= 1600 || progress.percent >= 99)) {
            lastEditTime = now;
            try {
              await ctx.api.editMessageText(
                ctx.chat.id,
                statusMsg.message_id,
                progress.formattedMessage
              );
            } catch {
              // Ignore rate limit or duplicate text edits
            }
          }
        },
      });

      // 2. Extract audio from the downloaded video to high quality MP3 (320 kbps)
      let mp3Result: AudioExtractionResult | null = null;
      let mp3ExtractionFailed = false;
      try {
        mp3Result = await extractAudioFromVideo(
          downloadResult.filePath,
          downloadResult.id,
          downloadResult.uploader || downloadResult.title
        );
      } catch (audioErr: any) {
        mp3ExtractionFailed = true;
        addBotLog('error', `MP3 extraction failed: ${audioErr.message}`);
      }

      const resolutionStr = downloadResult.verification?.resolution || 'Original Quality';
      const creatorStr = downloadResult.uploader || 'Instagram Creator';
      const mediaCaption = `🎬 Video by ${creatorStr}\n📺 ${resolutionStr} · ${downloadResult.fileSizeMB.toFixed(1)} MB`;

      try {
        // Update status to uploading
        if (statusMsg) {
          try {
            await ctx.api.editMessageText(
              ctx.chat.id,
              statusMsg.message_id,
              `✅ Download complete (${downloadResult.fileSizeMB.toFixed(1)} MB). Sending media...`
            );
          } catch {
            // ignore
          }
        }

        // 3. Send VIDEO
        let uploadSucceeded = false;
        try {
          await ctx.replyWithVideo(new InputFile(downloadResult.filePath), {
            caption: mediaCaption,
            supports_streaming: true,
          });
          uploadSucceeded = true;
        } catch (videoUploadErr: any) {
          const rawErr = (videoUploadErr.description || videoUploadErr.message || '').toString();
          const isSizeLimitation =
            rawErr.toLowerCase().includes('file is too big') ||
            rawErr.toLowerCase().includes('entity too large') ||
            rawErr.toLowerCase().includes('file_parts_too_much') ||
            rawErr.includes('413') ||
            (!botState.isUsingLocalBotApi && downloadResult.fileSizeMB > 50 && (rawErr.includes('Bad Request') || rawErr.includes('400')));

          if (!isSizeLimitation) {
            // If failure was not due to file size, try fallback to document stream
            try {
              await ctx.replyWithDocument(new InputFile(downloadResult.filePath, downloadResult.fileName), {
                caption: mediaCaption,
              });
              uploadSucceeded = true;
            } catch (docErr: any) {
              throw videoUploadErr;
            }
          } else {
            // The active Telegram Bot API server rejected the upload due to its file size limitation
            throw videoUploadErr;
          }
        }

        // 4. Send MP3 (or show notice if extraction failed)
        if (uploadSucceeded) {
          if (mp3Result) {
            try {
              await ctx.replyWithAudio(new InputFile(mp3Result.filePath, mp3Result.fileName), {
                caption: `🎵 Audio — MP3\n320 kbps`,
                title: downloadResult.title || 'Instagram Audio',
                performer: creatorStr,
              });
            } catch (audioSendErr: any) {
              addBotLog('error', `Failed to send MP3 audio: ${audioSendErr.message}`);
              await ctx.reply("⚠️ Video downloaded, but MP3 could not be sent.");
            }
          } else if (mp3ExtractionFailed) {
            await ctx.reply("⚠️ Video downloaded, but MP3 extraction failed.");
          }

          // Clean up status message
          if (statusMsg) {
            ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
          }

          botState.successfulDownloads++;
          addBotLog('success', `Sent media (${downloadResult.fileSizeMB.toFixed(1)}MB) + MP3 to @${ctx.from?.username || ctx.from?.id}`);
        }
      } catch (uploadError: any) {
        const errorDesc = (uploadError.description || uploadError.message || '').toString();
        const isSizeLimitation =
          errorDesc.toLowerCase().includes('file is too big') ||
          errorDesc.toLowerCase().includes('entity too large') ||
          errorDesc.toLowerCase().includes('file_parts_too_much') ||
          errorDesc.includes('413') ||
          (!botState.isUsingLocalBotApi && downloadResult.fileSizeMB > 50 && (errorDesc.includes('Bad Request') || errorDesc.includes('400')));

        if (isSizeLimitation) {
          // Accurately report Telegram's platform limitation rather than claiming an application limit
          const limitMsg =
`⚠️ Telegram API Server Upload Limitation

📦 Downloaded File Size: ${downloadResult.fileSizeMB.toFixed(1)} MB
📺 Quality: ${downloadResult.verification?.resolution || 'Original Quality'}

❌ Telegram API Rejection:
"${errorDesc}"

ℹ️ Why this happened:
The default public Telegram Cloud server (api.telegram.org) enforces a platform limit of 50 MB on HTTP bot uploads. Your media was downloaded in full original quality (${downloadResult.fileSizeMB.toFixed(1)} MB), but Telegram's cloud server refused to accept the file.

🚀 How to enable up to 2,000 MB (2 GB) uploads:
Run Telegram's official Local Bot API server (telegram-bot-api) and add this to your .env:
TELEGRAM_API_ROOT="http://your-server:8081"
When using a Local Bot API server, Telegram officially supports bot uploads up to 2 GB with this exact bot.`;

          if (statusMsg) {
            try {
              await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, limitMsg);
            } catch {
              await ctx.reply(limitMsg);
            }
          } else {
            await ctx.reply(limitMsg);
          }

          botState.failedDownloads++;
          addBotLog('error', `Telegram server rejected ${downloadResult.fileSizeMB.toFixed(1)}MB upload: ${errorDesc}`);
        } else {
          throw uploadError;
        }
      } finally {
        // Guarantee cleanup of both temporary video and MP3 files
        await downloadResult.cleanup();
        if (mp3Result) {
          await mp3Result.cleanup();
        }
        botState.activeDownloads = Math.max(0, botState.activeDownloads - 1);
      }
    } catch (err: any) {
      botState.failedDownloads++;
      botState.activeDownloads = Math.max(0, botState.activeDownloads - 1);
      addBotLog('error', `Failed to download: ${err.message}`);

      const userErrorMessage = `❌ Download Failed\n\n${err.message || 'Unable to process this link.'}`;
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
    const download = await downloadMedia(url);

    try {
      // Read file as base64 data URI so the simulator client can render/play it immediately
      const fs = await import('fs');
      const buffer = await fs.promises.readFile(download.filePath);
      const base64Data = buffer.toString('base64');
      const mediaDataUrl = `data:video/mp4;base64,${base64Data}`;

      const resBadge = download.verification?.resolution || 'Highest Quality';
      const progressPreview =
`⬇️ Downloading...
${renderProgressBar(100)} 100%

Speed: 42.1 MB/s
Size: ${download.fileSizeMB.toFixed(1)} MB
ETA: 0s`;

      const steps: SimulationResponse['steps'] = [
        { type: 'text', text: "⚡ Link received. Preparing your download..." },
        { type: 'text', text: progressPreview },
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

      // Send media directly without metadata messages
      steps.push({
        type: 'media',
        mediaUrl: mediaDataUrl,
        platform: 'instagram',
        sizeMB: Number(download.fileSizeMB.toFixed(1)),
        duration: formatDuration(download.duration),
        resolution: resBadge,
      });

      return { steps };
    } finally {
      // Clean up the temporary file immediately
      await download.cleanup();
    }
  } catch (err: any) {
    return {
      steps: [
        { type: 'text', text: "⚡ Link received. Preparing your download..." },
        {
          type: 'text',
          text: `❌ Error processing media: ${err.message || 'Network or media error.'}`,
        },
      ],
    };
  }
}
