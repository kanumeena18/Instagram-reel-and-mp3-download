/**
 * Standalone Telegram Instagram Downloader Bot Runner
 *
 * Usage:
 *   npm run bot
 *   OR: tsx src/bot.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { createTelegramBot } from './server/bot';
import { getExecutablePath } from './server/downloader';

async function main() {
  console.log('====================================================');
  console.log('   ⚡ INSTAGRAM DOWNLOADER TELEGRAM BOT (STANDALONE)');
  console.log('====================================================');
  console.log('🚀 Engine: yt-dlp + FFmpeg | Concurrency: 5 | Max Practical Quality');

  const token = process.env.BOT_TOKEN?.trim();

  if (!token || token === 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
    console.error('\n❌ ERROR: BOT_TOKEN is missing or not configured.');
    console.error('Please configure your BOT_TOKEN in your .env file:');
    console.error('  BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"\n');
    console.error('Get your bot token for free from @BotFather on Telegram.\n');
    process.exit(1);
  }

  const ytDlpPath = getExecutablePath();
  console.log(`ℹ️  Media Engine: yt-dlp (${ytDlpPath})`);

  try {
    const bot = createTelegramBot(token);
    const me = await bot.api.getMe();

    console.log(`✅ Logged in successfully as: @${me.username} (${me.first_name})`);
    console.log(`🚀 Telegram Bot is now RUNNING and listening for Instagram links!`);
    console.log('----------------------------------------------------');
    console.log('Supported links:');
    console.log('  • Instagram (Reels, video posts, p/ posts, tv, shares)');
    console.log('----------------------------------------------------');
    console.log('Press Ctrl + C to stop the bot gracefully.\n');

    // Handle graceful shutdown
    const handleShutdown = async () => {
      console.log('\n🛑 Stopping bot gracefully...');
      await bot.stop();
      console.log('👋 Bot has stopped.');
      process.exit(0);
    };

    process.once('SIGINT', handleShutdown);
    process.once('SIGTERM', handleShutdown);

    // Start long polling
    await bot.start();
  } catch (err: any) {
    console.error('\n❌ Fatal error starting bot:', err.message || err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled initialization error:', err);
  process.exit(1);
});
