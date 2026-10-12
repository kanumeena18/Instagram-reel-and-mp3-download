import React, { useState } from 'react';
import { Copy, Check, Terminal, ExternalLink, HelpCircle, AlertTriangle, ShieldCheck, Download, FolderPlus, Play } from 'lucide-react';

interface CodeSnippetProps {
  code: string;
  language?: string;
}

const CodeSnippet: React.FC<CodeSnippetProps> = ({ code, language = 'bash' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group bg-slate-50 border border-slate-200/90 rounded-2xl overflow-hidden my-3 shadow-[inset_0_1.5px_3px_0_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100/80 border-b border-slate-200/80 text-[11px] font-mono text-slate-500">
        <span className="font-semibold uppercase tracking-wider">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="font-medium">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-slate-800 overflow-x-auto whitespace-pre-wrap select-all leading-relaxed">
        {code}
      </pre>
    </div>
  );
};

export const WindowsGuide: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Intro Header - Clay Card */}
      <div className="clay-card p-6 sm:p-8 space-y-2">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Complete Windows Installation Guide</h2>
        <p className="text-sm text-slate-500">
          Step-by-step beginner guide to set up and run this Telegram Downloader Bot on any Windows 10 or 11 computer. Every command is copy-paste ready.
        </p>
      </div>

      {/* Step 1: Software Requirements */}
      <div className="clay-card p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-200/80 pb-4">
          <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-700 font-bold flex items-center justify-center text-sm font-mono border border-sky-200 shadow-sm">
            01
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Install Required Software</h3>
            <p className="text-xs text-slate-500">Install Node.js, FFmpeg, and yt-dlp on your Windows machine.</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-700">
          <div className="clay-inset p-5 space-y-2.5">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <span>A. Node.js (Version 20+ or LTS)</span>
            </h4>
            <p className="text-xs text-slate-500">
              Download and run the official Windows Installer (.msi). Click "Next" on all default options.
            </p>
            <a
              href="https://nodejs.org/en/download"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-800 font-semibold"
            >
              <span>Download Node.js for Windows (nodejs.org)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="clay-inset p-5 space-y-2.5">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <span>B. Quick Install via Windows PowerShell (Recommended)</span>
            </h4>
            <p className="text-xs text-slate-500">
              Open <strong>PowerShell as Administrator</strong> (press Windows Key, type <code className="text-sky-700 font-mono font-medium">powershell</code>, right-click, choose <em>Run as Administrator</em>) and paste this single command:
            </p>
            <CodeSnippet
              language="powershell"
              code="winget install OpenJS.NodeJS.LTS Gyan.FFmpeg yt-dlp.yt-dlp"
            />
            <p className="text-[11px] text-slate-400">
              This installs Node.js, FFmpeg (for video & audio stream merging), and yt-dlp automatically and configures your Windows PATH.
            </p>
          </div>
        </div>
      </div>

      {/* Step 2: Project Folder & Code */}
      <div className="clay-card p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-200/80 pb-4">
          <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-700 font-bold flex items-center justify-center text-sm font-mono border border-sky-200 shadow-sm">
            02
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Create Project Folder & Download Code</h3>
            <p className="text-xs text-slate-500">Place the project files on your Windows machine.</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-700">
          <p>Open regular Command Prompt or PowerShell, then navigate to your preferred folder (like Documents or Desktop):</p>
          <CodeSnippet
            language="cmd"
            code={`mkdir C:\\telegram-downloader\ncd C:\\telegram-downloader`}
          />
          <p className="text-xs text-slate-500">
            Copy all files from this project into <code className="text-sky-700 font-mono font-semibold">C:\telegram-downloader</code>.
          </p>
        </div>
      </div>

      {/* Step 3: Install Dependencies */}
      <div className="clay-card p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-200/80 pb-4">
          <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-700 font-bold flex items-center justify-center text-sm font-mono border border-sky-200 shadow-sm">
            03
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Install Node.js Dependencies</h3>
            <p className="text-xs text-slate-500">Installs Grammy (Telegram library), Express, and tooling.</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-700">
          <p>In your command prompt, inside the project folder, run:</p>
          <CodeSnippet language="cmd" code="npm install" />
          <p className="text-xs text-slate-500">
            Wait ~30 seconds until the installation completes with "added XX packages".
          </p>
        </div>
      </div>

      {/* Step 4: Configure BOT_TOKEN */}
      <div className="clay-card p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-200/80 pb-4">
          <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-700 font-bold flex items-center justify-center text-sm font-mono border border-sky-200 shadow-sm">
            04
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Get Bot Token & Create .env File</h3>
            <p className="text-xs text-slate-500">Obtain your secret token from Telegram's official @BotFather.</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-700">
          <ol className="list-decimal list-inside space-y-2 text-xs text-slate-600">
            <li>Open Telegram and search for <strong>@BotFather</strong> (verified with blue checkmark).</li>
            <li>Send the command <code className="text-sky-700 font-mono font-semibold">/newbot</code>.</li>
            <li>Choose a name for your bot (e.g., <code className="text-sky-700 font-mono font-semibold">My Media Saver</code>).</li>
            <li>Choose a username ending in 'bot' (e.g., <code className="text-sky-700 font-mono font-semibold">MyMediaSaver_bot</code>).</li>
            <li>BotFather will give you a token like: <code className="text-emerald-700 font-mono font-semibold">7123456789:AAHk123456...</code></li>
          </ol>

          <p className="pt-2">Create a file named <code className="text-sky-700 font-mono font-semibold">.env</code> in your project root with this content:</p>
          <CodeSnippet
            language="env"
            code={`# Telegram Token from @BotFather:\nBOT_TOKEN="7123456789:AAHk123456_YOUR_ACTUAL_TOKEN_HERE"\n\n# Optional: Set to your local Bot API server for 2 GB uploads (defaults to api.telegram.org)\nTELEGRAM_API_ROOT="https://api.telegram.org"\n\nPORT=3000`}
          />
        </div>
      </div>

      {/* Step 5: Start the Bot */}
      <div className="clay-card p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-200/80 pb-4">
          <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-700 font-bold flex items-center justify-center text-sm font-mono border border-sky-200 shadow-sm">
            05
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Start the Bot</h3>
            <p className="text-xs text-slate-500">Run the bot in standalone mode or with web dashboard.</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <p className="font-semibold text-slate-900 text-xs">Option A: Pure Standalone Telegram Bot (Terminal only)</p>
            <CodeSnippet language="cmd" code="npm run bot" />
          </div>

          <div className="pt-2">
            <p className="font-semibold text-slate-900 text-xs">Option B: Full-Stack (Bot + Interactive Web Dashboard)</p>
            <CodeSnippet language="cmd" code="npm run dev" />
            <p className="text-xs text-slate-500 mt-1">
              Then open your browser at <code className="text-sky-700 font-mono font-semibold">http://localhost:3000</code>.
            </p>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-xs text-emerald-800 flex items-center gap-2.5 shadow-sm">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>You will see: <strong>✅ Logged in successfully as: @YourBotName. Telegram Bot is now RUNNING!</strong></span>
          </div>
        </div>
      </div>

      {/* Step 6: Test It */}
      <div className="clay-card p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-200/80 pb-4">
          <div className="w-9 h-9 rounded-2xl bg-sky-50 text-sky-700 font-bold flex items-center justify-center text-sm font-mono border border-sky-200 shadow-sm">
            06
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">How to Test the Bot</h3>
            <p className="text-xs text-slate-500">Open Telegram and start downloading.</p>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-700">
          <div className="space-y-2.5 text-xs">
            <div className="flex items-start gap-2.5">
              <span className="font-bold text-sky-600 font-mono">1.</span>
              <span>Open Telegram on your phone or PC and open your bot's chat.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="font-bold text-sky-600 font-mono">2.</span>
              <span>Click or send <strong>/start</strong>. The bot will reply with the professional welcome message.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="font-bold text-sky-600 font-mono">3.</span>
              <span>Send any Instagram link (e.g., Reel, video post, photo).</span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="font-bold text-sky-600 font-mono">4.</span>
              <span>Bot responds: <em>"⚡ Link received. Preparing your download..."</em></span>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="font-bold text-sky-600 font-mono">5.</span>
              <span>Bot sends: <em>"✅ Download complete."</em> and immediately sends the playable MP4 video + high-fidelity 320 kbps MP3!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 7: Troubleshooting & Common Errors */}
      <div className="clay-card p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-200/80 pb-4">
          <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 font-bold flex items-center justify-center text-sm font-mono border border-amber-200 shadow-sm">
            07
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Fixing Common Errors</h3>
            <p className="text-xs text-slate-500">Quick solutions for common setup issues.</p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs text-slate-700">
          <div className="clay-inset p-4 space-y-1">
            <h4 className="font-semibold text-rose-800">Issue: "'yt-dlp' or 'ffmpeg' is not recognized as an internal or external command"</h4>
            <p className="text-slate-600">
              Solution: Windows hasn't reloaded your PATH yet. Close all Command Prompt or PowerShell windows and open a new one. Or install them using <code className="text-sky-700 font-mono">winget install Gyan.FFmpeg yt-dlp.yt-dlp</code>.
            </p>
          </div>

          <div className="clay-inset p-4 space-y-1">
            <h4 className="font-semibold text-amber-800">Issue: "401 Unauthorized" or "Bad Token"</h4>
            <p className="text-slate-600">
              Solution: Check your <code className="text-sky-700 font-mono">.env</code> file. Make sure there are no extra spaces or quotes inside the token value. The token should look like <code className="text-sky-700 font-mono">123456789:AAH...</code>.
            </p>
          </div>

          <div className="clay-inset p-4 space-y-1">
            <h4 className="font-semibold text-sky-900">Telegram API Upload Limitations (50 MB vs 2,000 MB)</h4>
            <p className="text-slate-600 leading-relaxed">
              The standard public Telegram Cloud Bot API server (<code className="text-sky-700 font-mono">api.telegram.org</code>) strictly limits bot HTTP uploads to 50 MB. This is an external Telegram server policy, not an application setting. To send videos up to <strong>2,000 MB (2 GB)</strong>, run Telegram's official open-source <a href="https://core.telegram.org/bots/api#using-a-local-bot-api-server" target="_blank" rel="noreferrer" className="text-sky-700 underline font-semibold">Local Bot API Server</a> and configure <code className="text-sky-700 font-mono">TELEGRAM_API_ROOT="http://localhost:8081"</code> in your <code className="text-sky-700 font-mono">.env</code>.
            </p>
          </div>

          <div className="clay-inset p-4 space-y-1">
            <h4 className="font-semibold text-slate-800">Issue: "Temporary storage filling up"</h4>
            <p className="text-slate-600">
              Solution: The bot has built-in auto-cleanup! Temporary files in <code className="text-sky-700 font-mono">temp/</code> are automatically unlinked immediately after being sent to the user.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

