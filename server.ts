import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  botState,
  simulateBotResponse,
  startBot,
  stopBot,
} from './src/server/bot';
import {
  detectPlatform,
  downloadMedia,
  extractUrl,
  getExecutablePath,
  getMediaInfo,
} from './src/server/downloader';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// API Routes

// System and Bot Status
app.get('/api/status', (req: Request, res: Response) => {
  const envToken = process.env.BOT_TOKEN?.trim();
  const hasEnvToken = Boolean(envToken && envToken !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE');

  res.json({
    status: 'ok',
    bot: {
      isRunning: botState.isRunning,
      username: botState.botUsername,
      botId: botState.botId,
      totalProcessed: botState.totalProcessed,
      successfulDownloads: botState.successfulDownloads,
      failedDownloads: botState.failedDownloads,
      activeDownloads: botState.activeDownloads,
      startedAt: botState.startedAt,
      isUsingLocalBotApi: botState.isUsingLocalBotApi,
      activeApiRoot: botState.activeApiRoot,
    },
    system: {
      ytDlpPath: getExecutablePath(),
      hasEnvToken,
      platform: process.platform,
      nodeVersion: process.version,
      isUsingLocalBotApi: botState.isUsingLocalBotApi,
      activeApiRoot: botState.activeApiRoot,
    },
  });
});

// Logs Endpoint
app.get('/api/logs', (req: Request, res: Response) => {
  res.json({
    logs: botState.logs,
  });
});

// Start Bot
app.post('/api/bot/start', async (req: Request, res: Response) => {
  const token = req.body?.token?.trim() || process.env.BOT_TOKEN?.trim();

  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid Telegram Bot Token.',
    });
  }

  const result = await startBot(token);
  if (result.success) {
    return res.json({
      success: true,
      botInfo: result.botInfo,
    });
  } else {
    return res.status(500).json({
      success: false,
      error: result.error,
    });
  }
});

// Stop Bot
app.post('/api/bot/stop', async (req: Request, res: Response) => {
  await stopBot();
  res.json({ success: true, message: 'Bot stopped successfully' });
});

// Simulate Telegram Message (For testing in web UI without a bot token)
app.post('/api/bot/simulate', async (req: Request, res: Response) => {
  const message = req.body?.message;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message text is required.' });
  }

  try {
    const simulation = await simulateBotResponse(message);
    res.json(simulation);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Simulation encountered an unexpected error.',
    });
  }
});

// Extract Media Info directly for inspector
app.post('/api/media/info', async (req: Request, res: Response) => {
  const url = req.body?.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required.' });
  }

  try {
    const info = await getMediaInfo(url);
    res.json(info);
  } catch (err: any) {
    res.status(400).json({
      error: err.message || 'Failed to inspect link.',
    });
  }
});

// Direct Download Stream for Link Tester
app.get('/api/media/download', async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) {
    return res.status(400).send('URL query parameter is required');
  }

  try {
    const download = await downloadMedia(rawUrl);
    const stat = await fs.promises.stat(download.filePath);

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(download.fileName)}"`);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(download.filePath);
    stream.pipe(res);

    stream.on('end', async () => {
      await download.cleanup();
    });

    stream.on('error', async () => {
      await download.cleanup();
    });
  } catch (err: any) {
    res.status(500).send(`Download failed: ${err.message || 'Unknown error'}`);
  }
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Development mode: Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Static files
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Telegram Downloader Server running on http://localhost:${PORT}`);

    // If a valid bot token is already present in environment, auto-start the live bot
    const envToken = process.env.BOT_TOKEN?.trim();
    if (envToken && envToken !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
      console.log('🤖 Auto-starting Telegram Bot with BOT_TOKEN from environment...');
      startBot(envToken).catch((err) => {
        console.error('Failed to auto-start Telegram Bot:', err);
      });
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
