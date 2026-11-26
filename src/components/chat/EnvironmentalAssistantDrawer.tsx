import { Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { sendAssistantMessage } from '../../services/apiClient.ts';
import type { AirQualitySnapshot, CarbonFootprintResult, ChatMessage } from '../../types/airQuality.ts';

interface EnvironmentalAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: AirQualitySnapshot | null;
  carbonResult: CarbonFootprintResult | null;
}

const SUGGESTED_QUESTIONS = [
  'Is it safe to go running outdoors right now?',
  'Which indoor air purifier filter works best for PM2.5?',
  'How does wind speed change local pollution levels?',
  'How can I lower my annual carbon footprint fastest?',
];

export function EnvironmentalAssistantDrawer({
  isOpen,
  onClose,
  snapshot,
  carbonResult,
}: EnvironmentalAssistantDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content:
        'Hello! I am the VayuMitra Environmental Assistant. Ask me about current air quality, respiratory protection, atmospheric dispersion, or carbon reduction strategies.',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSend = async (promptText?: string) => {
    const text = (promptText ?? input).trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setError(null);
    setIsSending(true);

    try {
      const reply = await sendAssistantMessage({
        message: text,
        history: nextHistory,
        context: snapshot
          ? {
              locationName: `${snapshot.location.name}, ${snapshot.location.country}`,
              aqi: snapshot.aqi,
              dominantPollutant: snapshot.dominantPollutant,
              pm25: snapshot.pollutants.pm25,
              temperatureC: snapshot.weather.temperatureC,
              humidityPct: snapshot.weather.humidityPct,
              windSpeedKmh: snapshot.weather.windSpeedKmh,
              carbonTonnesPerYear: carbonResult?.totalTonnesCo2e,
            }
          : undefined,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach assistant.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="VayuMitra Environmental AI Assistant"
      className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-xs"
      onClick={onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white dark:bg-[#0B0E17] border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              Environmental Assistant
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {snapshot
                ? `Grounded in ${snapshot.location.name} · AQI ${snapshot.aqi}`
                : 'Atmospheric & Sustainability Guidance'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close assistant drawer"
            className="p-2 min-h-[38px] min-w-[38px] rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message List */}
        <div
          aria-live="polite"
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-medium'
                    : 'bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-3 text-xs bg-slate-100 dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                Analyzing atmospheric data...
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300"
            >
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Suggested Prompts */}
        <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleSend(q)}
              disabled={isSending}
              className="text-left px-2.5 py-1.5 text-[11px] rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] text-slate-600 dark:text-slate-300 hover:border-sky-500 dark:hover:border-cyan-400 cursor-pointer transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
        >
          <label htmlFor="ai-chat-input" className="sr-only">
            Ask an environmental or air quality question
          </label>
          <input
            ref={inputRef}
            id="ai-chat-input"
            type="text"
            maxLength={1000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about AQI, health, or emissions..."
            className="flex-1 min-h-[42px] px-3.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            aria-label="Send message"
            className="min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </aside>
    </div>
  );
}
