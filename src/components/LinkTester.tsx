import React, { useState } from 'react';
import {
  Search,
  Download,
  AlertTriangle,
  Loader2,
  ExternalLink,
  FileVideo,
  ListPlus,
  Link as SingleLinkIcon,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  RotateCcw,
} from 'lucide-react';

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

interface BatchItem {
  id: string;
  url: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  info?: MediaInfo;
  error?: string;
}

export const LinkTester: React.FC = () => {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [url, setUrl] = useState('');
  const [batchText, setBatchText] = useState('');
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

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

  const handleDirectDownload = (targetMedia?: MediaInfo) => {
    const item = targetMedia || mediaInfo;
    if (!item) return;
    setDownloading(true);
    const downloadEndpoint = `/api/media/download?url=${encodeURIComponent(item.url)}`;
    const anchor = document.createElement('a');
    anchor.href = downloadEndpoint;
    anchor.download = `${item.title.substring(0, 30)}.${item.ext || 'mp4'}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => setDownloading(false), 3000);
  };

  const handleStartBatch = async () => {
    const lines = batchText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const initialItems: BatchItem[] = lines.map((link, idx) => ({
      id: `batch-${Date.now()}-${idx}`,
      url: link,
      status: 'idle',
    }));

    setBatchItems(initialItems);
    setIsBatchRunning(true);

    // Process with controlled 2-worker concurrency for fast inspection without overwhelming network
    const concurrency = 2;
    let cursor = 0;
    const worker = async () => {
      while (cursor < initialItems.length) {
        const i = cursor++;
        const item = initialItems[i];

        setBatchItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: 'loading' } : it))
        );

        try {
          const res = await fetch('/api/media/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to inspect link');
          }

          setBatchItems((prev) =>
            prev.map((it, idx) =>
              idx === i ? { ...it, status: 'success', info: data } : it
            )
          );
        } catch (err: any) {
          setBatchItems((prev) =>
            prev.map((it, idx) =>
              idx === i ? { ...it, status: 'error', error: err.message || 'Inspection failed' } : it
            )
          );
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, initialItems.length) }, () => worker())
    );

    setIsBatchRunning(false);
  };

  const handleLoadSampleBatch = () => {
    setBatchText(
      `https://www.instagram.com/reel/C8q43Z_Mxxx/\nhttps://www.instagram.com/p/C8q43Z_Mxxx/\nhttps://www.instagram.com/reel/DAbCD12345/`
    );
  };

  const approxMb = mediaInfo?.filesizeApprox ? (mediaInfo.filesizeApprox / (1024 * 1024)).toFixed(1) : null;
  const isOverTelegramLimit = approxMb ? Number(approxMb) > 50 : false;

  const totalBatch = batchItems.length;
  const successBatch = batchItems.filter((b) => b.status === 'success').length;
  const errorBatch = batchItems.filter((b) => b.status === 'error').length;
  const pendingBatch = batchItems.filter((b) => b.status === 'idle' || b.status === 'loading').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 shadow-[inset_0_1.5px_3px_0_rgba(15,23,42,0.04)]">
          <button
            onClick={() => setMode('single')}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              mode === 'single'
                ? 'clay-tab-active'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <SingleLinkIcon className="w-3.5 h-3.5" />
            <span>Single Link Inspector</span>
          </button>
          <button
            onClick={() => setMode('batch')}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              mode === 'batch'
                ? 'clay-tab-active'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>Batch Multi-Link Tester</span>
          </button>
        </div>

        {mode === 'batch' && (
          <button
            onClick={handleLoadSampleBatch}
            disabled={isBatchRunning}
            className="text-xs text-sky-700 hover:text-sky-900 font-medium px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-sm transition-all"
          >
            Load Sample Links
          </button>
        )}
      </div>

      {mode === 'single' ? (
        <>
          {/* Single Link Input Section - Clay Card */}
          <div className="clay-card p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Instagram Media Inspector & Downloader</h2>
              <p className="text-sm text-slate-500 mt-1">
                Directly test Instagram Reels and post link parsing, stream extraction, and media quality.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste Instagram link here (e.g. https://www.instagram.com/reel/...)"
                className="flex-1 clay-input px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button
                onClick={() => handleInspect()}
                disabled={!url.trim() || loading}
                className="clay-btn-primary px-6 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>Inspect Media</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 pt-1 text-xs">
              <span className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">Quick Links:</span>
              {presets.map((preset) => (
                <button
                  key={preset.title}
                  onClick={() => handleInspect(preset.url)}
                  disabled={loading}
                  className="px-3 py-1 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-all font-medium"
                >
                  {preset.title}
                </button>
              ))}
            </div>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-start gap-3 text-rose-700 text-sm shadow-[0_4px_12px_-2px_rgba(244,63,94,0.08)]">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
                <div>
                  <p className="font-semibold text-rose-900">Extraction Error</p>
                  <p className="mt-0.5 text-rose-700">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Media Inspection Result Card - Clay Card */}
          {mediaInfo && (
            <div className="clay-card p-6 sm:p-8 space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Thumbnail */}
                <div className="w-full md:w-72 aspect-video bg-slate-100 rounded-2xl overflow-hidden relative shrink-0 border border-slate-200/80 shadow-[0_4px_12px_-2px_rgba(15,23,42,0.06)]">
                  {mediaInfo.thumbnail ? (
                    <img
                      src={mediaInfo.thumbnail}
                      alt={mediaInfo.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <FileVideo className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 bg-white/90 backdrop-blur rounded-lg text-[11px] font-mono font-semibold uppercase text-sky-700 shadow-sm border border-slate-200/60">
                    {mediaInfo.platform}
                  </div>
                  {mediaInfo.durationString && (
                    <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 bg-slate-900/80 backdrop-blur rounded-lg text-[11px] font-mono text-white shadow-sm">
                      {mediaInfo.durationString}
                    </div>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex-1 space-y-4">
                  <h3 className="text-lg font-bold text-slate-900 line-clamp-2">{mediaInfo.title}</h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 text-xs">
                    <div className="clay-inset p-3">
                      <span className="text-slate-400 font-medium block text-[11px]">Creator / Handle</span>
                      <span className="text-slate-800 font-semibold truncate block mt-0.5">
                        {mediaInfo.uploader || 'Instagram User'}
                      </span>
                    </div>
                    <div className="clay-inset p-3">
                      <span className="text-slate-400 font-medium block text-[11px]">Stream Resolution</span>
                      <span className="text-slate-800 font-mono font-semibold block mt-0.5">
                        {mediaInfo.resolution || 'Auto / Highest'}
                      </span>
                    </div>
                    <div className="clay-inset p-3">
                      <span className="text-slate-400 font-medium block text-[11px]">Estimated Size</span>
                      <span className="text-slate-800 font-mono font-semibold block mt-0.5">
                        {approxMb ? `${approxMb} MB` : 'Dynamic stream'}
                      </span>
                    </div>
                  </div>

                  {/* Telegram Server Capability Notice */}
                  {isOverTelegramLimit && (
                    <div className="p-3.5 bg-sky-50 border border-sky-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-sky-800">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-sky-600 mt-0.5" />
                      <div>
                        <span className="font-semibold text-sky-950">Telegram Upload Server Capability: </span>
                        This media is ~{approxMb} MB in original full quality. Standard Telegram Cloud API enforces a 50 MB HTTP bot upload limit, while a Telegram Local Bot API server supports up to 2,000 MB (2 GB). You can download the uncompressed file directly below!
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={() => handleDirectDownload()}
                      disabled={downloading}
                      className="clay-btn-success px-5 py-2.5 text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                    >
                      {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span>Download Media</span>
                    </button>

                    <a
                      href={mediaInfo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="clay-btn-secondary px-4 py-2.5 text-sm font-medium flex items-center gap-1.5"
                    >
                      <span>Open Instagram Link</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Batch Multi-Link Tester Mode */
        <div className="space-y-6">
          <div className="clay-card p-6 sm:p-8 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Batch Instagram Link Tester</h2>
              <p className="text-sm text-slate-500 mt-1">
                Paste multiple Instagram URLs at once (one per line). Inspect stream status, creator metadata, and resolution simultaneously.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 block">
                Instagram URLs (One link per line)
              </label>
              <textarea
                rows={5}
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder="https://www.instagram.com/reel/C8q43Z_Mxxx/&#10;https://www.instagram.com/p/C8q43Z_Mxxx/&#10;https://www.instagram.com/reel/DAbCD12345/"
                disabled={isBatchRunning}
                className="w-full clay-input p-3.5 text-xs sm:text-sm font-mono text-slate-800 placeholder-slate-400 focus:outline-none resize-y leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-400 font-medium">
                {batchText.split('\n').filter((l) => l.trim().length > 0).length} links detected in input
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setBatchText('');
                    setBatchItems([]);
                  }}
                  disabled={isBatchRunning || (!batchText && batchItems.length === 0)}
                  className="clay-btn-secondary px-4 py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>

                <button
                  onClick={handleStartBatch}
                  disabled={isBatchRunning || !batchText.trim()}
                  className="clay-btn-primary px-6 py-2.5 text-xs sm:text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  {isBatchRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Testing Links ({pendingBatch} remaining)...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Test All Links</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Results Summary & Table */}
          {batchItems.length > 0 && (
            <div className="clay-card p-6 sm:p-8 space-y-5">
              {/* Stats Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Batch Inspection Results
                </h3>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span>Total:</span>
                    <strong className="text-slate-900 tabular-nums">{totalBatch}</strong>
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Valid:</span>
                    <strong className="tabular-nums">{successBatch}</strong>
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Failed:</span>
                    <strong className="tabular-nums">{errorBatch}</strong>
                  </span>
                  {pendingBatch > 0 && (
                    <span className="flex items-center gap-1.5 text-sky-700">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                      <span>In Progress:</span>
                      <strong className="tabular-nums">{pendingBatch}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-sm bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4 w-28">Status</th>
                      <th className="py-3 px-4">URL</th>
                      <th className="py-3 px-4">Title / Creator</th>
                      <th className="py-3 px-4 w-24">Resolution</th>
                      <th className="py-3 px-4 w-24">Est. Size</th>
                      <th className="py-3 px-4 w-24 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchItems.map((item, idx) => {
                      const approxSize = item.info?.filesizeApprox
                        ? (item.info.filesizeApprox / (1024 * 1024)).toFixed(1) + ' MB'
                        : item.info ? 'Stream' : '—';

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono text-slate-400 text-center text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Status Indicator */}
                          <td className="py-3.5 px-4">
                            {item.status === 'idle' && (
                              <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Queued</span>
                              </span>
                            )}
                            {item.status === 'loading' && (
                              <span className="inline-flex items-center gap-1.5 text-sky-600 font-medium">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Testing...</span>
                              </span>
                            )}
                            {item.status === 'success' && (
                              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Available</span>
                              </span>
                            )}
                            {item.status === 'error' && (
                              <span className="inline-flex items-center gap-1.5 text-rose-700 font-semibold">
                                <XCircle className="w-4 h-4 text-rose-600" />
                                <span>Failed</span>
                              </span>
                            )}
                          </td>

                          {/* URL */}
                          <td className="py-3.5 px-4 font-mono text-slate-600 max-w-xs truncate">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-sky-700 hover:underline flex items-center gap-1"
                              title={item.url}
                            >
                              <span className="truncate">{item.url}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                            </a>
                            {item.status === 'error' && (
                              <p className="text-[11px] text-rose-600 font-sans mt-0.5 line-clamp-1">
                                {item.error}
                              </p>
                            )}
                          </td>

                          {/* Title / Creator */}
                          <td className="py-3.5 px-4 text-slate-800 max-w-xs">
                            {item.info ? (
                              <div>
                                <p className="font-semibold line-clamp-1 text-slate-900">{item.info.title}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  {item.info.uploader || 'Instagram Creator'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Resolution */}
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {item.info?.resolution || (item.info ? 'Original' : '—')}
                          </td>

                          {/* Estimated Size */}
                          <td className="py-3.5 px-4 font-mono text-slate-600">
                            {approxSize}
                          </td>

                          {/* Action */}
                          <td className="py-3.5 px-4 text-right">
                            {item.status === 'success' && item.info ? (
                              <button
                                onClick={() => handleDirectDownload(item.info)}
                                className="clay-btn-success px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1"
                                title="Download MP4"
                              >
                                <Download className="w-3 h-3" />
                                <span>Save</span>
                              </button>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


