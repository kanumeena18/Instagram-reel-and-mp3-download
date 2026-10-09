import React, { useState, useEffect } from 'react';
import { Play, Square, Eye, EyeOff, CheckCircle2, XCircle, AlertCircle, RefreshCw, Terminal, Activity, Radio, Cpu } from 'lucide-react';

interface BotLogEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'download' | 'error' | 'success';
  message: string;
}

interface BotStatusResponse {
  bot: {
    isRunning: boolean;
    username?: string;
    botId?: number;
    totalProcessed: number;
    successfulDownloads: number;
    failedDownloads: number;
    activeDownloads: number;
    startedAt?: string;
    isUsingLocalBotApi?: boolean;
    activeApiRoot?: string;
  };
  system: {
    ytDlpPath: string;
    hasEnvToken: boolean;
    platform: string;
    nodeVersion: string;
    isUsingLocalBotApi?: boolean;
    activeApiRoot?: string;
  };
}

export const BotManager: React.FC = () => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BotStatusResponse | null>(null);
  const [logs, setLogs] = useState<BotLogEvent[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // ignore
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStartBot = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start bot');
      }
      fetchStatus();
      fetchLogs();
    } catch (err: any) {
      setActionError(err.message || 'Error starting bot');
    } finally {
      setLoading(false);
    }
  };

  const handleStopBot = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/bot/stop', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to stop bot');
      }
      fetchStatus();
      fetchLogs();
    } catch (err: any) {
      setActionError(err.message || 'Error stopping bot');
    } finally {
      setLoading(false);
    }
  };

  const isRunning = status?.bot.isRunning ?? false;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Bot Controller Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Radio className={`w-5 h-5 ${isRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span>Live Telegram Bot Runner</span>
            </h2>
            <p className="text-sm text-slate-400">
              Run the production Telegram bot in real-time to listen and respond to actual Telegram chats.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                isRunning
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700/60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
              <span>{isRunning ? 'Active & Polling' : 'Stopped'}</span>
            </span>
          </div>
        </div>

        {/* Telegram Bot Token Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">
            Telegram Bot Token (from @BotFather)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={
                  status?.system.hasEnvToken
                    ? 'Using BOT_TOKEN from environment (.env)'
                    : '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ...'
                }
                disabled={isRunning}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition-colors font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                title={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {isRunning ? (
              <button
                onClick={handleStopBot}
                disabled={loading}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                <Square className="w-4 h-4" />
                <span>Stop Bot</span>
              </button>
            ) : (
              <button
                onClick={handleStartBot}
                disabled={loading || (!token.trim() && !status?.system.hasEnvToken)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                <span>Start Live Bot</span>
              </button>
            )}
          </div>
          {status?.system.hasEnvToken && (
            <p className="text-[11px] text-emerald-400 font-mono">
              ✓ Pre-configured BOT_TOKEN detected in environment (.env).
            </p>
          )}
        </div>

        {actionError && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-200">Bot Error</p>
              <p className="mt-0.5">{actionError}</p>
            </div>
          </div>
        )}

        {/* Telegram API Server Capability Mode */}
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Telegram API Endpoint:</span>
            <span className="font-mono text-sky-300 font-medium">
              {status?.system.activeApiRoot || 'https://api.telegram.org'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Upload Capability:</span>
            <span className="font-mono text-emerald-400 font-semibold">
              {status?.system.isUsingLocalBotApi ? 'Up to 2,000 MB (Local Server)' : '50 MB (Public Cloud Limit)'}
            </span>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 block">Bot Username</span>
            <span className="text-sm font-mono font-bold text-sky-400 truncate block mt-1">
              {status?.bot.username ? `@${status.bot.username}` : 'Not connected'}
            </span>
          </div>
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 block">Total Processed</span>
            <span className="text-xl font-mono font-bold text-white tabular-nums block mt-1">
              {status?.bot.totalProcessed ?? 0}
            </span>
          </div>
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 block">Successful Delivered</span>
            <span className="text-xl font-mono font-bold text-emerald-400 tabular-nums block mt-1">
              {status?.bot.successfulDownloads ?? 0}
            </span>
          </div>
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400 block">Active Downloads</span>
            <span className="text-xl font-mono font-bold text-sky-300 tabular-nums block mt-1">
              {status?.bot.activeDownloads ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Activity Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-400" />
            <span>Live Activity Stream</span>
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Auto-refreshes every 3s</span>
        </div>

        <div className="h-60 overflow-y-auto bg-slate-950 border border-slate-800/80 rounded-xl p-4 font-mono text-xs space-y-2">
          {logs.length === 0 ? (
            <div className="text-slate-600 italic">No events recorded yet. Send a link to start seeing activity.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5">
                <span className="text-slate-500 shrink-0 select-none">[{log.timestamp}]</span>
                <span
                  className={`font-semibold shrink-0 uppercase text-[10px] px-1 rounded ${
                    log.type === 'success'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : log.type === 'error'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : log.type === 'download'
                      ? 'bg-sky-950 text-sky-400 border border-sky-800'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {log.type}
                </span>
                <span className="text-slate-300 break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
