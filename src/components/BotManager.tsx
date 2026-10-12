import React, { useState, useEffect } from 'react';
import {
  Play,
  Square,
  Eye,
  EyeOff,
  AlertCircle,
  Terminal,
  Radio,
  Lock,
  ShieldCheck,
  LogOut,
  KeyRound,
  Check,
  X,
  Database,
} from 'lucide-react';

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
    platform?: string;
    nodeVersion?: string;
    isUsingLocalBotApi?: boolean;
    activeApiRoot?: string;
  };
}

export const BotManager: React.FC = () => {
  // Session Authentication State (express-session + connect-sqlite3)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Login Form State
  const [loginUser, setLoginUser] = useState('admin');
  const [loginPass, setLoginPass] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Change Password State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeMsg, setPasswordChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Bot Controller State
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BotStatusResponse | null>(null);
  const [logs, setLogs] = useState<BotLogEvent[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  // Verify Active Session on Mount
  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch('/admin/session', {
          credentials: 'include',
        });
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticated(true);
          setAdminUsername(data.username || 'admin');
        } else {
          setIsAuthenticated(false);
          setAdminUsername(null);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };

    verifySession();
  }, []);

  // Fetch Status and Logs via Session
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      // ignore
    }
  };

  const fetchLogs = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/admin/logs', {
        credentials: 'include',
      });
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
    if (isAuthenticated) {
      fetchLogs();
    }
    const interval = setInterval(() => {
      fetchStatus();
      if (isAuthenticated) {
        fetchLogs();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Handle Admin Session Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsSubmittingLogin(true);

    try {
      const res = await fetch('/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Please verify credentials.');
      }

      setIsAuthenticated(true);
      setAdminUsername(data.username || 'admin');
      setLoginPass('');
    } catch (err: any) {
      setLoginError(err.message || 'Authentication error.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  // Handle Admin Session Logout
  const handleLogout = async () => {
    try {
      await fetch('/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setAdminUsername(null);
  };

  // Handle Password Change with bcrypt
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordChangeMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordChangeMsg({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await fetch('/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Password update failed.');
      }

      setPasswordChangeMsg({ type: 'success', text: 'Password successfully updated! Please log in again.' });
      setTimeout(() => {
        handleLogout();
        setShowPasswordModal(false);
      }, 1500);
    } catch (err: any) {
      setPasswordChangeMsg({ type: 'error', text: err.message || 'Error updating password.' });
    } finally {
      setIsChangingPass(false);
    }
  };

  // Handle Start Bot (Admin Protected)
  const handleStartBot = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/admin/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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

  // Handle Stop Bot (Admin Protected)
  const handleStopBot = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/admin/bot/stop', {
        method: 'POST',
        credentials: 'include',
      });
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

  if (authLoading) {
    return (
      <div className="clay-card p-12 text-center max-w-lg mx-auto space-y-4">
        <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-medium text-slate-500">Checking active SQLite admin session...</p>
      </div>
    );
  }

  // ==========================================
  // VIEW: ADMIN AUTHENTICATION REQUIRED
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto space-y-6">
        <div className="clay-card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Admin Session Required</h2>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Live Telegram Bot execution and system diagnostic logs require an authenticated session in SQLite.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Administrator Username</label>
              <input
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                required
                className="w-full clay-input px-3.5 py-2.5 text-sm rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                placeholder="admin"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setShowLoginPass(!showLoginPass)}
                  className="text-[11px] text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
                >
                  {showLoginPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showLoginPass ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showLoginPass ? 'text' : 'password'}
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  required
                  className="w-full clay-input px-3.5 py-2.5 text-sm rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  placeholder="Enter administrator password..."
                />
              </div>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                <span className="leading-snug">{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingLogin}
              className="w-full clay-btn-primary py-2.5 px-4 text-sm font-semibold rounded-xl text-white flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-60"
            >
              {isSubmittingLogin ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sign In as Admin</span>
                </>
              )}
            </button>
          </form>

          <div className="clay-inset p-3 rounded-xl text-[11px] text-slate-500 space-y-1">
            <div className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-600" />
              <span>Session Architecture</span>
            </div>
            <p>
              Protected by <strong className="text-slate-700">express-session</strong> with <strong className="text-slate-700">connect-sqlite3</strong> storage. Passwords validated via <strong className="text-slate-700">bcrypt</strong> with 12 salt rounds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: ADMIN AUTHENTICATED
  // ==========================================
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Admin Session Header Bar */}
      <div className="clay-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/95 border border-sky-100 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
              <span>SQLite Admin Session Active</span>
              <span className="text-[10px] bg-sky-100 text-sky-800 font-mono px-1.5 py-0.5 rounded">
                @{adminUsername}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Authenticated with express-session + connect-sqlite3 store (bcrypt verified)</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPasswordModal(!showPasswordModal)}
            className="px-3 py-1.5 clay-btn text-xs font-medium rounded-xl text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
            <span>Change Password</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 clay-btn text-xs font-medium rounded-xl text-rose-600 hover:text-rose-700 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Password Change Drawer */}
      {showPasswordModal && (
        <div className="clay-card p-6 space-y-4 border border-sky-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-sky-600" />
              <span>Update Administrator Password (bcrypt)</span>
            </h3>
            <button
              onClick={() => setShowPasswordModal(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  className="w-full clay-input px-3 py-2 text-xs rounded-xl"
                  placeholder="Old password..."
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">New Password (min 8)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full clay-input px-3 py-2 text-xs rounded-xl"
                  placeholder="New password..."
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full clay-input px-3 py-2 text-xs rounded-xl"
                  placeholder="Confirm password..."
                />
              </div>
            </div>

            {passwordChangeMsg && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  passwordChangeMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {passwordChangeMsg.type === 'success' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{passwordChangeMsg.text}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isChangingPass}
                className="clay-btn-primary px-4 py-1.5 text-xs font-semibold text-white rounded-xl shadow cursor-pointer"
              >
                {isChangingPass ? 'Hashing & Updating...' : 'Save New Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bot Controller Card - Clay Card */}
      <div className="clay-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Radio className={`w-5 h-5 ${isRunning ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
              <span>Live Telegram Bot Runner</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Run the production Telegram bot in real-time to listen and respond to actual Telegram chats.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border shadow-sm ${
                isRunning
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-slate-400'}`}></span>
              <span>{isRunning ? 'Active & Polling' : 'Stopped'}</span>
            </span>
          </div>
        </div>

        {/* Telegram Bot Token Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 block">
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
                className="w-full clay-input px-4 py-2.5 text-sm font-mono rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!isRunning ? (
                <button
                  onClick={handleStartBot}
                  disabled={loading}
                  className="clay-btn-primary px-5 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md text-white disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Start Bot</span>
                </button>
              ) : (
                <button
                  onClick={handleStopBot}
                  disabled={loading}
                  className="clay-btn-danger px-5 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md text-white disabled:opacity-50"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>Stop Bot</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            {status?.system.hasEnvToken
              ? '✓ System has BOT_TOKEN configured in environment. Leaving input blank will use it automatically.'
              : 'Provide your Telegram token above or configure BOT_TOKEN in .env'}
          </p>
        </div>

        {actionError && (
          <div className="p-4 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-start gap-3 text-rose-700 text-sm shadow-[0_4px_12px_-2px_rgba(244,63,94,0.08)]">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">Bot Error</p>
              <p className="mt-0.5 text-rose-700">{actionError}</p>
            </div>
          </div>
        )}

        {/* Telegram API Server Capability Mode */}
        <div className="clay-inset p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Telegram API Endpoint:</span>
            <span className="font-mono text-sky-700 font-semibold">
              {status?.system.activeApiRoot || 'https://api.telegram.org'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Upload Capability:</span>
            <span className="font-mono text-emerald-700 font-semibold">
              {status?.system.isUsingLocalBotApi ? 'Up to 2,000 MB (Local Server)' : '50 MB (Public Cloud Limit)'}
            </span>
          </div>
        </div>

        {/* Live Metrics Grid - Tactile Clay Insets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="clay-inset p-4">
            <span className="text-xs text-slate-500 font-medium block">Bot Username</span>
            <span className="text-sm font-mono font-bold text-sky-600 truncate block mt-1">
              {status?.bot.username ? `@${status.bot.username}` : 'Not connected'}
            </span>
          </div>
          <div className="clay-inset p-4">
            <span className="text-xs text-slate-500 font-medium block">Total Processed</span>
            <span className="text-xl font-mono font-bold text-slate-900 tabular-nums block mt-1">
              {status?.bot.totalProcessed ?? 0}
            </span>
          </div>
          <div className="clay-inset p-4">
            <span className="text-xs text-slate-500 font-medium block">Successful Delivered</span>
            <span className="text-xl font-mono font-bold text-emerald-600 tabular-nums block mt-1">
              {status?.bot.successfulDownloads ?? 0}
            </span>
          </div>
          <div className="clay-inset p-4">
            <span className="text-xs text-slate-500 font-medium block">Active Downloads</span>
            <span className="text-xl font-mono font-bold text-sky-600 tabular-nums block mt-1">
              {status?.bot.activeDownloads ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* Real-time Activity Logs - Clean Claymorphic Container */}
      <div className="clay-card p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-sky-600" />
            <span>Live Activity Stream</span>
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">Auto-refreshes every 3s via session</span>
        </div>

        <div className="h-60 overflow-y-auto bg-slate-50 border border-slate-200/90 rounded-2xl p-4 font-mono text-xs space-y-2 shadow-[inset_0_2px_4px_rgba(15,23,42,0.03)]">
          {logs.length === 0 ? (
            <div className="text-slate-400 italic">No events recorded yet. Send a link to start seeing activity.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5">
                <span className="text-slate-400 shrink-0 select-none">[{log.timestamp}]</span>
                <span
                  className={`font-semibold shrink-0 uppercase text-[10px] px-1.5 py-0.5 rounded-md ${
                    log.type === 'success'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : log.type === 'error'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : log.type === 'download'
                      ? 'bg-sky-100 text-sky-800 border border-sky-200'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {log.type}
                </span>
                <span className="text-slate-700 break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
