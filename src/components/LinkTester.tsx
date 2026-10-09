import React, { useState } from 'react';
import { Search, Download, AlertTriangle, Video, Loader2, ExternalLink, FileVideo } from 'lucide-react';

interface MediaInfo {
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

export const LinkTester: React.FC = () => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    { title: 'Instagram Reel Demo', url: 'https://www.instagram.com/reel/C8q43Z_Mxxx/' },
    { title: 'Instagram Post Demo', url: 'https://www.instagram.com/p/C8q43Z_Mxxx/' },
  ];

  const handleInspect = async (targetUrl?: string) => {
    const inputUrl = (targetUrl || url).trim();
    if (!inputUrl) return;

    if (targetUrl) {
      setUrl(targetUrl);
    }

    setLoading(true);
    setError(null);
    setMediaInfo(null);

    try {
      const res = await fetch('/api/media/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to inspect media link');
      }

      setMediaInfo(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred while inspecting link.');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectDownload = () => {
    if (!mediaInfo) return;
    setDownloading(true);
    const downloadEndpoint = `/api/media/download?url=${encodeURIComponent(mediaInfo.url)}`;
    const anchor = document.createElement('a');
    anchor.href = downloadEndpoint;
    anchor.download = `${mediaInfo.title.substring(0, 30)}.${mediaInfo.ext || 'mp4'}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => setDownloading(false), 3000);
  };

  const approxMb = mediaInfo?.filesizeApprox ? (mediaInfo.filesizeApprox / (1024 * 1024)).toFixed(1) : null;
  const isOverTelegramLimit = approxMb ? Number(approxMb) > 50 : false;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Input Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Instagram Media Inspector & Downloader</h2>
          <p className="text-sm text-slate-400">
            Directly test Instagram Reels and post link parsing, stream extraction, and media quality.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste Instagram link here..."
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
          />
          <button
            onClick={() => handleInspect()}
            disabled={!url.trim() || loading}
            className="px-6 py-3 bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-sky-500/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Inspect Media</span>
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 pt-2 text-xs">
          <span className="text-slate-500 font-medium">Quick Links:</span>
          {presets.map((preset) => (
            <button
              key={preset.title}
              onClick={() => handleInspect(preset.url)}
              disabled={loading}
              className="px-2.5 py-1 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded-md transition-colors"
            >
              {preset.title}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-300 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
            <div>
              <p className="font-semibold text-rose-200">Extraction Error</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Media Inspection Result Card */}
      {mediaInfo && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Thumbnail */}
            <div className="w-full md:w-64 aspect-video bg-black rounded-xl overflow-hidden relative shrink-0 border border-slate-800">
              {mediaInfo.thumbnail ? (
                <img
                  src={mediaInfo.thumbnail}
                  alt={mediaInfo.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <FileVideo className="w-12 h-12" />
                </div>
              )}
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 backdrop-blur rounded text-[11px] font-mono font-semibold uppercase text-sky-400">
                {mediaInfo.platform}
              </div>
              {mediaInfo.durationString && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur rounded text-[11px] font-mono text-white">
                  {mediaInfo.durationString}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="flex-1 space-y-3">
              <h3 className="text-lg font-bold text-white line-clamp-2">{mediaInfo.title}</h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block">Creator / Handle</span>
                  <span className="text-slate-200 font-medium truncate block mt-0.5">
                    {mediaInfo.uploader || 'Instagram User'}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block">Stream Resolution</span>
                  <span className="text-slate-200 font-mono font-medium block mt-0.5">
                    {mediaInfo.resolution || 'Auto / Highest'}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-slate-500 block">Estimated Size</span>
                  <span className="text-slate-200 font-mono font-medium block mt-0.5">
                    {approxMb ? `${approxMb} MB` : 'Dynamic stream'}
                  </span>
                </div>
              </div>

              {/* Telegram Server Capability Notice */}
              {isOverTelegramLimit && (
                <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-start gap-2.5 text-xs text-sky-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
                  <div>
                    <span className="font-semibold text-sky-200">Telegram Upload Server Capability: </span>
                    This media is ~{approxMb} MB in original full quality. Standard Telegram Cloud API (api.telegram.org) enforces a 50 MB HTTP bot upload limit, while a Telegram Local Bot API server (telegram-bot-api) supports up to 2,000 MB (2 GB). You can download the uncompressed file directly below!
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={handleDirectDownload}
                  disabled={downloading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-sm flex items-center gap-2 transition-colors shadow-md shadow-emerald-600/20 disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Download Media</span>
                </button>

                <a
                  href={mediaInfo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm flex items-center gap-1.5 transition-colors border border-slate-700/60"
                >
                  <span>Open Instagram Link</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
