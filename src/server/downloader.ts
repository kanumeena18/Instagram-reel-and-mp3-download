import { execFile, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface MediaMetadata {
  rawUrl: string;
  platform: 'instagram';
  title: string;
  originalUrl: string;
}

export interface QualityVerification {
  isValid: boolean;
  resolution: string;
  height?: number;
  width?: number;
  videoCodec: string;
  audioCodec: string;
  hasAudio: boolean;
  duration: number;
  sizeMB: number;
  container: string;
}

export interface ProgressData {
  percent: number;
  speed: string;
  downloaded: string;
  total: string;
  eta: string;
  stage: 'downloading' | 'merging' | 'verifying';
  formattedMessage: string;
}

export interface MediaInfo {
  id: string;
  url: string;
  title: string;
  platform: 'instagram';
  duration?: number;
  durationString?: string;
  thumbnail?: string;
  uploader?: string;
  resolution?: string;
  filesizeApprox?: number;
  ext?: string;
  directUrl?: string;
}

export interface DownloadResult {
  id: string;
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeMB: number;
  title: string;
  uploader?: string;
  platform: 'instagram';
  duration?: number;
  thumbnail?: string;
  verification: QualityVerification;
  cleanup: () => Promise<void>;
}

export interface AudioExtractionResult {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeMB: number;
  bitrateKbps: number;
  duration?: number;
  cleanup: () => Promise<void>;
}

// Locate yt-dlp executable across platforms (Linux, Windows, macOS, local bin)
export function getExecutablePath(): string {
  if (process.env.YT_DLP_PATH && fs.existsSync(process.env.YT_DLP_PATH)) {
    return process.env.YT_DLP_PATH;
  }

  // Check local bin directory
  const localLinux = path.resolve(process.cwd(), 'bin', 'yt-dlp');
  if (fs.existsSync(localLinux)) {
    return localLinux;
  }

  const localWin = path.resolve(process.cwd(), 'bin', 'yt-dlp.exe');
  if (fs.existsSync(localWin)) {
    return localWin;
  }

  // System PATH default
  return process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
}

// Locate ffmpeg executable across platforms
export function getFFmpegPath(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  const localLinux = path.resolve(process.cwd(), 'bin', 'ffmpeg');
  if (fs.existsSync(localLinux)) {
    return localLinux;
  }

  const localWin = path.resolve(process.cwd(), 'bin', 'ffmpeg.exe');
  if (fs.existsSync(localWin)) {
    return localWin;
  }

  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
}

// Locate ffprobe executable across platforms
export function getFFprobePath(): string {
  if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
    return process.env.FFPROBE_PATH;
  }

  const localLinux = path.resolve(process.cwd(), 'bin', 'ffprobe');
  if (fs.existsSync(localLinux)) {
    return localLinux;
  }

  const localWin = path.resolve(process.cwd(), 'bin', 'ffprobe.exe');
  if (fs.existsSync(localWin)) {
    return localWin;
  }

  return process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
}

// Extract audio from video file to MP3 (320 kbps high quality)
export async function extractAudioFromVideo(
  videoFilePath: string,
  baseId: string,
  titleOrCreator?: string
): Promise<AudioExtractionResult> {
  const tempDir = path.dirname(videoFilePath);

  // Clean, sanitized filename
  const safeName = (titleOrCreator || 'Instagram_Audio')
    .replace(/[^\w\s\-_]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .substring(0, 60) || 'Instagram_Audio';

  const mp3FileName = `${baseId}_${safeName}.mp3`;
  const mp3FilePath = path.join(tempDir, mp3FileName);

  const ffmpeg = getFFmpegPath();

  // FFmpeg high-quality MP3 conversion: 320 kbps, ultrafast preset to minimize processing time
  const args = [
    '-y',
    '-i',
    videoFilePath,
    '-vn',                 // discard video stream
    '-c:a',
    'libmp3lame',          // standard MP3 encoder
    '-b:a',
    '320k',                // 320 kbps high bitrate
    '-preset',
    'ultrafast',
    mp3FilePath,
  ];

  await execFileAsync(ffmpeg, args, { timeout: 35000 });

  if (!fs.existsSync(mp3FilePath)) {
    throw new Error('MP3 audio file was not created by FFmpeg.');
  }

  const stat = await fs.promises.stat(mp3FilePath);
  if (stat.size < 1024) {
    throw new Error('Extracted MP3 file is invalid or zero bytes.');
  }

  const fileSizeMB = stat.size / (1024 * 1024);

  return {
    filePath: mp3FilePath,
    fileName: `${safeName}.mp3`,
    fileSizeBytes: stat.size,
    fileSizeMB,
    bitrateKbps: 320,
    cleanup: async () => {
      try {
        if (fs.existsSync(mp3FilePath)) {
          await fs.promises.unlink(mp3FilePath);
        }
      } catch {
        // ignore unlink error
      }
    },
  };
}

// URL extraction & Instagram detection
export function extractUrl(text: string): string | null {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlRegex);
  return matches && matches.length > 0 ? matches[0].trim() : null;
}

export function detectPlatform(url: string): 'instagram' | null {
  if (!url) return null;
  const clean = url.trim().toLowerCase();

  // Instagram matchers: Reels, video posts, p/ posts, tv, stories/shares
  const isInstagram =
    clean.includes('instagram.com/p/') ||
    clean.includes('instagram.com/reel/') ||
    clean.includes('instagram.com/reels/') ||
    clean.includes('instagram.com/tv/') ||
    clean.includes('instagram.com/share/') ||
    clean.includes('instagr.am/p/') ||
    clean.includes('instagr.am/reel/');

  if (isInstagram) return 'instagram';

  return null;
}

// Format seconds into MM:SS or HH:MM:SS
export function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format byte count to human-readable string
export function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return 'Unknown size';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export function formatCount(val: any): string {
  if (val === undefined || val === null || val === '') return 'Not available';
  const num = Number(val);
  if (isNaN(num)) return 'Not available';
  return num.toLocaleString();
}

export function formatDate(val: any): string {
  if (!val) return 'Not available';
  const str = String(val).trim();
  if (/^\d{8}$/.test(str)) {
    const y = str.substring(0, 4);
    const m = str.substring(4, 6);
    const d = str.substring(6, 8);
    return `${y}-${m}-${d}`;
  }
  if (/^\d{10}$/.test(str)) {
    const date = new Date(Number(str) * 1000);
    return date.toISOString().split('T')[0];
  }
  return str;
}

export function truncateText(text: any, maxLen = 220): string {
  if (!text || typeof text !== 'string') return 'Not available';
  const trimmed = text.replace(/[\r\n]+/g, ' ').trim();
  if (!trimmed) return 'Not available';
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.substring(0, maxLen)}...`;
}

// Helper to render graphical progress bar: ████████░░ 80%
export function renderProgressBar(percent: number, length = 10): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// Parse yt-dlp stdout line for progress
export function parseYtDlpProgress(line: string): ProgressData | null {
  if (!line) return null;

  if (line.includes('[Merger]') || line.includes('Merging formats')) {
    return {
      percent: 100,
      speed: 'Fast',
      downloaded: '100%',
      total: '100%',
      eta: '0s',
      stage: 'merging',
      formattedMessage: `⚙️ Merging highest quality video & audio streams...\n${renderProgressBar(100)} 100%`,
    };
  }

  // Example line: [download]  45.2% of  102.34MiB at   14.25MiB/s ETA 00:04
  const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?([^\s]+)(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/i);
  if (!match) return null;

  const percent = parseFloat(match[1]) || 0;
  const total = match[2] || '';
  const speed = match[3] || 'calculating...';
  const eta = match[4] || 'soon';

  const progressBar = renderProgressBar(percent);
  const formattedMessage =
`⬇️ Downloading...
${progressBar} ${percent.toFixed(0)}%

Speed: ${speed}
Size: ${total}
ETA: ${eta}`;

  return {
    percent,
    speed,
    downloaded: `${percent.toFixed(0)}%`,
    total,
    eta,
    stage: 'downloading',
    formattedMessage,
  };
}

// Verify downloaded media file with ffprobe & filesystem checks
export async function verifyQuality(
  filePath: string,
  infoJson: any = {}
): Promise<QualityVerification> {
  const stat = await fs.promises.stat(filePath);
  const sizeMB = stat.size / (1024 * 1024);

  let width = infoJson?.width;
  let height = infoJson?.height;
  let videoCodec = infoJson?.vcodec || 'h264';
  let audioCodec = infoJson?.acodec || 'aac';
  let hasAudio = audioCodec && audioCodec !== 'none';
  let duration = typeof infoJson?.duration === 'number' ? infoJson.duration : 0;
  let container = path.extname(filePath).replace('.', '') || 'mp4';

  // Attempt deep inspection with ffprobe for absolute verification
  try {
    const ffprobePath = getFFprobePath();
    const args = [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,codec_name,width,height',
      '-show_entries',
      'format=duration,size,format_name',
      '-of',
      'json',
      filePath,
    ];

    const { stdout } = await execFileAsync(ffprobePath, args, { timeout: 8000 });
    const parsed = JSON.parse(stdout);

    if (Array.isArray(parsed.streams)) {
      const videoStream = parsed.streams.find((s: any) => s.codec_type === 'video');
      const audioStream = parsed.streams.find((s: any) => s.codec_type === 'audio');

      if (videoStream) {
        if (videoStream.width) width = videoStream.width;
        if (videoStream.height) height = videoStream.height;
        if (videoStream.codec_name) videoCodec = videoStream.codec_name;
      }

      if (audioStream) {
        hasAudio = true;
        if (audioStream.codec_name) audioCodec = audioStream.codec_name;
      }
    }

    if (parsed.format?.duration) {
      duration = parseFloat(parsed.format.duration);
    }
    if (parsed.format?.format_name) {
      container = parsed.format.format_name.split(',')[0];
    }
  } catch {
    // ffprobe not in PATH or timed out; fallback to yt-dlp extracted metadata
  }

  let resolution = 'Highest Available';
  if (height && width) {
    if (height >= 2160) resolution = `${width}x${height} (4K UHD)`;
    else if (height >= 1440) resolution = `${width}x${height} (2K 1440p)`;
    else if (height >= 1080) resolution = `${width}x${height} (1080p FHD)`;
    else if (height >= 720) resolution = `${width}x${height} (720p HD)`;
    else resolution = `${width}x${height} (${height}p)`;
  } else if (height) {
    resolution = `${height}p`;
  }

  return {
    isValid: stat.size > 1024,
    resolution,
    height,
    width,
    videoCodec,
    audioCodec,
    hasAudio,
    duration,
    sizeMB,
    container,
  };
}

// Fetch media metadata without downloading the full video
export async function getMediaInfo(rawUrl: string): Promise<MediaInfo> {
  const platform = detectPlatform(rawUrl);
  if (!platform) {
    throw new Error('Unsupported URL. Please provide a valid Instagram link.');
  }

  const ytDlp = getExecutablePath();
  const args = [
    '--dump-single-json',
    '--no-warnings',
    '--no-playlist',
    '--socket-timeout',
    '15',
    rawUrl,
  ];

  try {
    const { stdout } = await execFileAsync(ytDlp, args, { maxBuffer: 10 * 1024 * 1024 });
    const json = JSON.parse(stdout);

    const title = json.title || json.fulltitle || 'Instagram Media';
    const duration = typeof json.duration === 'number' ? json.duration : undefined;
    const thumbnail = json.thumbnail || (Array.isArray(json.thumbnails) && json.thumbnails.length > 0 ? json.thumbnails[json.thumbnails.length - 1].url : undefined);
    const uploader = json.uploader || json.channel || json.uploader_id;
    const resolution = json.resolution || (json.width && json.height ? `${json.width}x${json.height}` : undefined);
    const filesizeApprox = json.filesize || json.filesize_approx;

    return {
      id: json.id || String(Date.now()),
      url: rawUrl,
      title,
      platform: 'instagram',
      duration,
      durationString: formatDuration(duration),
      thumbnail,
      uploader,
      resolution,
      filesizeApprox,
      ext: json.ext || 'mp4',
      directUrl: json.url,
    };
  } catch (err: any) {
    const errorMsg = (err.stderr || err.message || '').toString();
    if (errorMsg.includes('Private video') || errorMsg.includes('login') || errorMsg.includes('account is private')) {
      throw new Error('This Instagram media is private or requires authentication to view.');
    }
    if (errorMsg.includes('Video unavailable') || errorMsg.includes('not found') || errorMsg.includes('404')) {
      throw new Error('This Instagram media is unavailable or has been deleted.');
    }
    throw new Error(`Failed to extract Instagram media: ${errorMsg.slice(0, 200)}`);
  }
}

// Download Instagram media with maximum practical quality, speed optimizations, and progress updates
export async function downloadMedia(
  rawUrl: string,
  options: {
    onProgress?: (progress: ProgressData) => void;
  } = {}
): Promise<DownloadResult> {
  const platform = detectPlatform(rawUrl);
  if (!platform) {
    throw new Error('Unsupported URL. Please provide a valid Instagram link.');
  }

  const tempDir = path.resolve(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const outputTemplate = path.join(tempDir, `${id}.%(ext)s`);
  const ytDlp = getExecutablePath();

  // Speed and highest-quality arguments for Instagram:
  // 1. Concurrent fragments: --concurrent-fragments 5
  // 2. Format selector: bestvideo+bestaudio/best (no downscaling, preserves original resolution/bitrate)
  // 3. Merging: FFmpeg merges streams into standard MP4
  // 4. Chunk & buffer optimization: --http-chunk-size 10M --buffer-size 1M
  const primaryArgs = [
    '--no-playlist',
    '--concurrent-fragments',
    '5',
    '--http-chunk-size',
    '10M',
    '--buffer-size',
    '1M',
    '-f',
    'bestvideo+bestaudio/best',
    '--format-sort',
    'res,fps,size,br',
    '--merge-output-format',
    'mp4',
    '--no-warnings',
    '--socket-timeout',
    '20',
    '--extractor-retries',
    '3',
    '-o',
    outputTemplate,
    '--write-info-json',
    rawUrl,
  ];

  const runDownloadProcess = (args: string[]): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn(ytDlp, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stderr = '';
      let stdout = '';

      proc.stdout.on('data', (chunk) => {
        const str = chunk.toString();
        stdout += str;

        if (options.onProgress) {
          const lines = str.split(/[\r\n]+/);
          for (const line of lines) {
            const parsed = parseYtDlpProgress(line);
            if (parsed) {
              options.onProgress(parsed);
              break;
            }
          }
        }
      });

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn downloader process: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          const errText = stderr || stdout;
          if (errText.includes('Private video') || errText.includes('login') || errText.includes('account is private')) {
            return reject(new Error('This Instagram media is private or requires authentication.'));
          }
          if (errText.includes('Video unavailable') || errText.includes('not found') || errText.includes('404')) {
            return reject(new Error('Instagram media is unavailable or removed.'));
          }
          return reject(new Error(`Instagram download failed: ${errText.slice(0, 250)}`));
        }
        resolve();
      });
    });
  };

  try {
    // Execute download (Highest Available Quality without artificial compression)
    await runDownloadProcess(primaryArgs);

    // Locate downloaded file
    const files = await fs.promises.readdir(tempDir);
    const downloadedFile = files.find((f) => f.startsWith(id) && !f.endsWith('.json') && !f.endsWith('.part'));

    if (!downloadedFile) {
      throw new Error('Downloaded media file could not be located in temporary directory.');
    }

    const filePath = path.join(tempDir, downloadedFile);
    const stat = await fs.promises.stat(filePath);
    const fileSizeBytes = stat.size;
    const fileSizeMB = fileSizeBytes / (1024 * 1024);

    let parsedMetadata: any = {};
    const infoJsonPath = path.join(tempDir, `${id}.info.json`);
    if (fs.existsSync(infoJsonPath)) {
      try {
        const rawJson = await fs.promises.readFile(infoJsonPath, 'utf-8');
        parsedMetadata = JSON.parse(rawJson);
      } catch {
        // ignore info json parse errors
      }
    }

    // Verify final file
    const verification = await verifyQuality(filePath, parsedMetadata);

    const title = parsedMetadata.title || 'Instagram Media';
    const uploader = parsedMetadata.uploader || parsedMetadata.channel || parsedMetadata.uploader_id;
    const duration = typeof parsedMetadata.duration === 'number' ? parsedMetadata.duration : verification.duration;
    const thumbnail = parsedMetadata.thumbnail;

    const cleanup = async () => {
      await cleanupFiles(tempDir, id);
    };

    return {
      id,
      filePath,
      fileName: downloadedFile,
      fileSizeBytes,
      fileSizeMB,
      title,
      uploader,
      platform: 'instagram',
      duration,
      thumbnail,
      verification,
      cleanup,
    };
  } catch (err: any) {
    await cleanupFiles(tempDir, id).catch(() => {});
    throw err;
  }
}

// Clean up temporary files with matching ID prefix
async function cleanupFiles(directory: string, id: string): Promise<void> {
  try {
    const files = await fs.promises.readdir(directory);
    for (const file of files) {
      if (file.startsWith(id)) {
        const p = path.join(directory, file);
        try {
          await fs.promises.unlink(p);
        } catch {
          // ignore unlink error
        }
      }
    }
  } catch {
    // ignore readdir error
  }
}
