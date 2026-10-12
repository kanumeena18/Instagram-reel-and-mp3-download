import fs from 'fs';
import path from 'path';
import { DownloadResult, AudioExtractionResult } from './downloader';

export interface CachedEntry {
  url: string;
  normUrl: string;
  videoFilePath: string;
  videoFileName: string;
  videoSizeBytes: number;
  videoSizeMB: number;
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  resolution: string;
  mp3FilePath?: string;
  mp3FileName?: string;
  mp3SizeBytes?: number;
  mp3SizeMB?: number;
  createdAt: number;
  lastAccessedAt: number;
}

const CACHE_TTL_MS = 25 * 60 * 1000; // 25 minutes TTL
const MAX_CACHE_ENTRIES = 30;
const MAX_CACHE_SIZE_BYTES = 350 * 1024 * 1024; // 350 MB limit

const cacheStore = new Map<string, CachedEntry>();
const inFlightMap = new Map<string, Promise<{ download: DownloadResult; mp3?: AudioExtractionResult }>>();

// Cache directory setup
function getCacheDir(): string {
  const cacheDir = path.resolve(process.cwd(), 'temp', 'cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

/**
 * Normalizes Instagram URL to a canonical key to allow hit matching
 * e.g. https://www.instagram.com/reel/C8q43Z_Mxxx/?igsh=xyz -> https://www.instagram.com/reel/C8q43Z_Mxxx/
 */
export function normalizeInstagramUrl(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl.trim());
    let pathname = urlObj.pathname;
    if (!pathname.endsWith('/')) {
      pathname += '/';
    }
    // Match /p/ID/, /reel/ID/, /tv/ID/
    const match = pathname.match(/\/(reel|p|tv)\/([a-zA-Z0-9_-]+)\/?/);
    if (match) {
      return `https://www.instagram.com/${match[1]}/${match[2]}/`;
    }
    return `${urlObj.origin}${pathname}`;
  } catch {
    return rawUrl.trim().split('?')[0];
  }
}

/**
 * SingleFlight in-flight deduplication:
 * If a request for the same URL is already downloading, reuse that promise.
 */
export async function runSingleFlight(
  normUrl: string,
  fetchFn: () => Promise<{ download: DownloadResult; mp3?: AudioExtractionResult }>
): Promise<{ download: DownloadResult; mp3?: AudioExtractionResult }> {
  const existing = inFlightMap.get(normUrl);
  if (existing) {
    console.log(`⚡ [SingleFlight] Reusing in-flight download for: ${normUrl}`);
    return existing;
  }

  const promise = (async () => {
    try {
      const result = await fetchFn();
      return result;
    } finally {
      inFlightMap.delete(normUrl);
    }
  })();

  inFlightMap.set(normUrl, promise);
  return promise;
}

/**
 * Look up valid cached entry
 */
export function getCachedMedia(rawUrl: string): CachedEntry | null {
  const norm = normalizeInstagramUrl(rawUrl);
  const entry = cacheStore.get(norm);
  if (!entry) return null;

  // Check TTL
  const now = Date.now();
  if (now - entry.createdAt > CACHE_TTL_MS) {
    evictEntry(norm);
    return null;
  }

  // Verify file existence on disk
  if (!fs.existsSync(entry.videoFilePath)) {
    evictEntry(norm);
    return null;
  }

  entry.lastAccessedAt = now;
  return entry;
}

/**
 * Store completed media in cache with safely preserved persistent files
 */
export async function storeMediaInCache(
  rawUrl: string,
  download: DownloadResult,
  mp3?: AudioExtractionResult
): Promise<CachedEntry | null> {
  const norm = normalizeInstagramUrl(rawUrl);
  const cacheDir = getCacheDir();

  try {
    // Copy or hardlink video into persistent cache folder
    const ext = path.extname(download.filePath) || '.mp4';
    const cachedVideoName = `cached_${download.id}${ext}`;
    const cachedVideoPath = path.join(cacheDir, cachedVideoName);

    if (fs.existsSync(download.filePath)) {
      await fs.promises.copyFile(download.filePath, cachedVideoPath);
    } else {
      return null;
    }

    let cachedMp3Path: string | undefined = undefined;
    let cachedMp3Name: string | undefined = undefined;
    let mp3SizeBytes: number | undefined = undefined;
    let mp3SizeMB: number | undefined = undefined;

    if (mp3 && fs.existsSync(mp3.filePath)) {
      cachedMp3Name = `cached_${download.id}.mp3`;
      cachedMp3Path = path.join(cacheDir, cachedMp3Name);
      await fs.promises.copyFile(mp3.filePath, cachedMp3Path);
      mp3SizeBytes = mp3.fileSizeBytes;
      mp3SizeMB = mp3.fileSizeMB;
    }

    const entry: CachedEntry = {
      url: rawUrl,
      normUrl: norm,
      videoFilePath: cachedVideoPath,
      videoFileName: cachedVideoName,
      videoSizeBytes: download.fileSizeBytes,
      videoSizeMB: download.fileSizeMB,
      title: download.title,
      uploader: download.uploader,
      duration: download.duration,
      thumbnail: download.thumbnail,
      resolution: download.verification?.resolution || 'Original Quality',
      mp3FilePath: cachedMp3Path,
      mp3FileName: cachedMp3Name,
      mp3SizeBytes,
      mp3SizeMB,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    cacheStore.set(norm, entry);
    enforceCacheLimits();
    return entry;
  } catch (err: any) {
    console.warn('[Cache] Failed to store media in cache:', err.message);
    return null;
  }
}

function evictEntry(normUrl: string) {
  const entry = cacheStore.get(normUrl);
  if (entry) {
    cacheStore.delete(normUrl);
    try {
      if (entry.videoFilePath && fs.existsSync(entry.videoFilePath)) {
        fs.unlinkSync(entry.videoFilePath);
      }
      if (entry.mp3FilePath && fs.existsSync(entry.mp3FilePath)) {
        fs.unlinkSync(entry.mp3FilePath);
      }
    } catch {
      // ignore
    }
  }
}

function enforceCacheLimits() {
  if (cacheStore.size <= MAX_CACHE_ENTRIES) return;

  // Evict least recently accessed entries
  const entries = Array.from(cacheStore.values()).sort(
    (a, b) => a.lastAccessedAt - b.lastAccessedAt
  );

  while (entries.length > MAX_CACHE_ENTRIES) {
    const oldest = entries.shift();
    if (oldest) {
      evictEntry(oldest.normUrl);
    }
  }
}

// Background sweep for expired files every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [norm, entry] of cacheStore.entries()) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      evictEntry(norm);
    }
  }
}, 5 * 60 * 1000).unref();
