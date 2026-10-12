import React, { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Sparkles, AlertCircle, CheckCircle2, Loader2, Play, ExternalLink } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text?: string;
  type?: 'text' | 'media';
  mediaUrl?: string;
  title?: string;
  platform?: string;
  sizeMB?: number;
  duration?: string;
  timestamp: string;
  isStatus?: boolean;
}

const SAMPLE_PROMPTS = [
  { label: '/start', value: '/start' },
  { label: 'Instagram Reel Demo', value: 'https://www.instagram.com/reel/C8q43Z_Mxxx/' },
  { label: 'Instagram Post Demo', value: 'https://www.instagram.com/p/C8q43Z_Mxxx/' },
  { label: 'Unsupported Link', value: 'https://example.com/video/12345' },
];

const WELCOME_PROMPT = `Welcome to Instagram Media Downloader ⚡

Send an Instagram Reel or post link and I'll download the media in the highest available quality.

Fast • High Quality • Simple

Just paste your Instagram link to get started.`;

export const BotSimulator: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'bot',
      type: 'text',
      text: WELCOME_PROMPT,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    setInputText('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      type: 'text',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/bot/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();
      const steps = data.steps || [];

      // Display the steps with natural Telegram chat cadence
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 120));
        }

        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}-${i}`,
          sender: 'bot',
          type: step.type || 'text',
          text: step.text,
          mediaUrl: step.mediaUrl,
          title: step.title,
          platform: step.platform,
          sizeMB: step.sizeMB,
          duration: step.duration,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, botMsg]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          type: 'text',
          text: `❌ Unable to download this media: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: `init-${Date.now()}`,
        sender: 'bot',
        type: 'text',
        text: WELCOME_PROMPT,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[740px] max-w-4xl mx-auto clay-card overflow-hidden">
      {/* Telegram Chat Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/95 border-b border-slate-200/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-400 to-sky-600 flex items-center justify-center text-white font-bold text-sm shadow-[0_4px_12px_-2px_rgba(2,132,199,0.35),inset_0_1.5px_2px_0_rgba(255,255,255,0.4)]">
              ⚡
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">MediaFetch ⚡</h3>
            <p className="text-xs text-sky-600 font-mono">@MediaFetchBot · bot</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 clay-btn-secondary"
            title="Reset Conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-50/80 border-b border-slate-200/60 overflow-x-auto text-xs">
        <span className="text-slate-400 shrink-0 font-medium text-[11px] uppercase tracking-wider">Quick Test:</span>
        {SAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt.label}
            onClick={() => handleSend(prompt.value)}
            disabled={isProcessing}
            className="px-3 py-1 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-xl border border-slate-200/80 whitespace-nowrap shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all disabled:opacity-50"
          >
            {prompt.label}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-slate-50/50 to-white/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] px-4 py-3 text-sm leading-relaxed transition-all ${
                msg.sender === 'user'
                  ? 'clay-btn-primary rounded-2xl rounded-tr-sm text-white font-normal'
                  : 'bg-white text-slate-800 rounded-2xl rounded-tl-sm border border-slate-200/90 shadow-[0_8px_20px_-4px_rgba(15,23,42,0.05),inset_0_1px_2px_0_rgba(255,255,255,1)]'
              }`}
            >
              {msg.type === 'media' && msg.mediaUrl ? (
                <div className="space-y-2.5">
                  {msg.mediaUrl.startsWith('data:audio') || msg.mediaUrl.endsWith('.mp3') || msg.title?.includes('Audio') ? (
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)]">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                        <span className="flex items-center gap-1.5 text-sky-600 font-semibold">
                          <span>🎵</span> <span>Audio · 320 kbps MP3</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">{msg.sizeMB ? `${msg.sizeMB} MB` : ''}</span>
                      </div>
                      <audio src={msg.mediaUrl} controls className="w-full h-8" />
                    </div>
                  ) : (
                    <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-200/60 shadow-inner">
                      <video
                        src={msg.mediaUrl}
                        controls
                        className="w-full max-h-72 object-contain"
                        poster=""
                      />
                    </div>
                  )}

                  {msg.title && (
                    <div className="text-xs whitespace-pre-wrap text-slate-700 font-medium bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/60 leading-relaxed">
                      {msg.title}
                    </div>
                  )}
                </div>
              ) : (
                <div className="whitespace-pre-wrap">
                  {msg.text}
                </div>
              )}

              <div
                className={`text-[10px] mt-1 font-mono text-right ${
                  msg.sender === 'user' ? 'text-sky-100' : 'text-slate-400'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white text-slate-600 border border-slate-200/90 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-sm shadow-[0_8px_20px_-4px_rgba(15,23,42,0.05)]">
              <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
              <span>Processing media stream...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-4 bg-white border-t border-slate-200/80 flex items-center gap-3"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste Instagram URL or /start..."
          disabled={isProcessing}
          className="flex-1 clay-input px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isProcessing}
          className="clay-btn-primary px-5 py-2.5 text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Send</span>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

