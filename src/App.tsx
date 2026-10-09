import React, { useState, useEffect } from 'react';
import { BotSimulator } from './components/BotSimulator';
import { LinkTester } from './components/LinkTester';
import { BotManager } from './components/BotManager';
import { WindowsGuide } from './components/WindowsGuide';
import { Bot, Link, Settings, BookOpen, Radio, Sparkles, CheckCircle2 } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Contract (3 Zones) */}
      <header className="sticky top-0 z-50 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        {/* Zone 1: Single Brand Wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
            ⚡
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            MediaFetch
          </span>
        </div>

        {/* Zone 2: Navigation Links / Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'simulator'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Bot Simulator</span>
            <span className="sm:hidden">Bot</span>
          </button>

          <button
            onClick={() => setActiveTab('tester')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'tester'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Link className="w-4 h-4" />
            <span className="hidden sm:inline">Link Tester</span>
            <span className="sm:hidden">Tester</span>
          </button>

          <button
            onClick={() => setActiveTab('manager')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'manager'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Live Runner</span>
            <span className="sm:hidden">Runner</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Windows Guide</span>
            <span className="sm:hidden">Guide</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action / Status */}
        <div className="flex items-center gap-3">
          <div
            className={`px-2.5 py-1 rounded-full text-xs font-mono font-medium flex items-center gap-1.5 ${
              botRunning
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${botRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="hidden md:inline">
              {botRunning ? (botUsername ? `@${botUsername}` : 'Polling Active') : 'Bot Idle'}
            </span>
            <span className="md:hidden">{botRunning ? 'Live' : 'Idle'}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto">
        {activeTab === 'simulator' && <BotSimulator />}
        {activeTab === 'tester' && <LinkTester />}
        {activeTab === 'manager' && <BotManager />}
        {activeTab === 'guide' && <WindowsGuide />}
      </main>

      {/* Minimal Clean Footer */}
      <footer className="border-t border-slate-900 px-6 py-4 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-6xl w-full mx-auto">
        <p>Telegram Media Downloader · Instagram Downloader</p>
        <p className="font-mono text-slate-600">Highest Practical Quality · Fast Processing · Auto Cleanup</p>
      </footer>
    </div>
  );
}
