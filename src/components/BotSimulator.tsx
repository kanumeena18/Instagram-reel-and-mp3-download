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
          await new Promise((r) => setTimeout(r, 650));
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
    <div className="flex flex-col h-[740px] max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
      {/* Telegram Chat Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              ⚡
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">MediaFetch ⚡</h3>
            <p className="text-xs text-sky-400 font-mono">@MediaFetchBot · bot</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={resetChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors"
            title="Reset Conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/40 border-b border-slate-800/60 overflow-x-auto text-xs">
        <span className="text-slate-500 shrink-0 font-medium">Quick Test:</span>
        {SAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt.label}
            onClick={() => handleSend(prompt.value)}
            disabled={isProcessing}
            className="px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 rounded-md whitespace-nowrap transition-colors disabled:opacity-50"
          >
            {prompt.label}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-950/20">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-md ${
                msg.sender === 'user'
                  ? 'bg-sky-600 text-white rounded-tr-none'
                  : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-tl-none'
              }`}
            >
              {msg.type === 'media' && msg.mediaUrl ? (
                <div className="space-y-2">
                  <div className="rounded-xl overflow-hidden bg-black/60 border border-slate-700/50">
                    <video
                      src={msg.mediaUrl}
                      controls
                      className="w-full max-h-72 object-contain"
                      poster=""
                    />
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.text}
                </div>
              )}

              <div
                className={`text-[10px] mt-1 font-mono text-right ${
                  msg.sender === 'user' ? 'text-sky-200' : 'text-slate-400'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-slate-300 border border-slate-700/60 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 text-sm shadow-md">
              <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
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
        className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste Instagram URL or /start..."
          disabled={isProcessing}
          className="flex-1 bg-slate-950/80 border border-slate-800 focus:border-sky-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isProcessing}
          className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-white font-medium rounded-xl text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-sky-500/20"
        >
          <span>Send</span>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
