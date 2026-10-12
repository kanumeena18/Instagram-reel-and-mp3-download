import React, { useState, useEffect } from 'react';
import { BotSimulator } from './components/BotSimulator';
import { LinkTester } from './components/LinkTester';
import { BotManager } from './components/BotManager';
import { WindowsGuide } from './components/WindowsGuide';
import { Bot, Link as LinkIcon, Settings, BookOpen } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'tester' | 'manager' | 'guide'>('simulator');
  const [botRunning, setBotRunning] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          setBotRunning(data.bot?.isRunning ?? false);
          setBotUsername(data.bot?.username ?? null);
        }
      } catch {
        // ignore
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      {/* Top Bar Contract (3 Zones) with Claymorphic Elegance */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-[0_2px_12px_-2px_rgba(15,23,42,0.03)]">
        {/* Zone 1: Single Brand Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-sky-400 to-sky-600 text-white flex items-center justify-center font-bold text-sm shadow-[0_4px_10px_-2px_rgba(2,132,199,0.35),inset_0_1.5px_2px_0_rgba(255,255,255,0.4)]">
            ⚡
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900 block leading-tight">
              MediaFetch
            </span>
            <span className="text-[11px] font-medium text-slate-400 block leading-none">
              Instagram Downloader
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Links / Segmented Tabs */}
        <nav className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70 shadow-[inset_0_1.5px_3px_0_rgba(15,23,42,0.04)]">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'simulator'
                ? 'clay-tab-active font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Bot Simulator</span>
            <span className="sm:hidden">Bot</span>
          </button>

          <button
            onClick={() => setActiveTab('tester')}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'tester'
                ? 'clay-tab-active font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Link Tester</span>
            <span className="sm:hidden">Tester</span>
          </button>

          <button
            onClick={() => setActiveTab('manager')}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'manager'
                ? 'clay-tab-active font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Live Runner</span>
            <span className="sm:hidden">Runner</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'clay-tab-active font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Windows Guide</span>
            <span className="sm:hidden">Guide</span>
          </button>
        </nav>

        {/* Zone 3: Primary Status Indicator */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-medium flex items-center gap-2 border shadow-[0_2px_4px_rgba(15,23,42,0.02)] ${
              botRunning
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                botRunning ? 'bg-emerald-500 ring-2 ring-emerald-200 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="hidden md:inline font-semibold">
              {botRunning ? (botUsername ? `@${botUsername}` : 'Polling Active') : 'Bot Idle'}
            </span>
            <span className="md:hidden font-semibold">{botRunning ? 'Live' : 'Idle'}</span>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 p-4 sm:p-8 max-w-5xl w-full mx-auto space-y-6">
        {activeTab === 'simulator' && <BotSimulator />}
        {activeTab === 'tester' && <LinkTester />}
        {activeTab === 'manager' && <BotManager />}
        {activeTab === 'guide' && <WindowsGuide />}
      </main>

      {/* Minimal Clean Claymorphic Footer */}
      <footer className="border-t border-slate-200/80 bg-white/60 backdrop-blur px-6 py-5 text-xs text-slate-500">
        <div className="max-w-5xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <span>MediaFetch</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Instagram Media Downloader</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-slate-400">High-Fidelity Audio & Video</span>
          </div>
          <div className="text-slate-400 text-[11px] font-mono">
            Direct MP4 + 320 kbps MP3 · Auto Temp Cleanup
          </div>
        </div>
      </footer>
    </div>
  );
}

