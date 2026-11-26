import { Check, Copy, Download, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getAqiLevel } from '../../constants/aqiScale.ts';
import type { AirQualitySnapshot } from '../../types/airQuality.ts';

interface ShareReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: AirQualitySnapshot | null;
}

export function ShareReportModal({ isOpen, onClose, snapshot }: ShareReportModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !snapshot) return null;

  const level = getAqiLevel(snapshot.aqi);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const summaryText = `Air Quality Alert for ${snapshot.location.name}, ${snapshot.location.country}: US AQI ${snapshot.aqi} (${level.label}). PM2.5: ${snapshot.pollutants.pm25 ?? '--'} µg/m³ · Temp: ${snapshot.weather.temperatureC}°C · Wind: ${snapshot.weather.windSpeedKmh} km/h. Monitored on VayuMitra.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${summaryText} ${shareUrl}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `VayuMitra AQI — ${snapshot.location.name}`,
          text: summaryText,
          url: shareUrl,
        });
      } catch {
        // User cancelled share sheet
      }
    } else {
      await handleCopy();
    }
  };

  const handleDownloadCard = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#07090E';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

    ctx.fillStyle = '#22D3EE';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('VayuMitra Air Quality Report', 56, 76);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(`${snapshot.location.name}, ${snapshot.location.country}`, 56, 140);

    ctx.fillStyle = level.hex;
    ctx.font = 'bold 112px monospace';
    ctx.fillText(String(snapshot.aqi), 56, 285);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(`${level.symbol} ${level.label}`, 280, 240);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '20px monospace';
    ctx.fillText(
      `PM2.5: ${snapshot.pollutants.pm25 ?? '--'} ug/m3  |  PM10: ${snapshot.pollutants.pm10 ?? '--'} ug/m3`,
      280,
      282,
    );
    ctx.fillText(
      `Temp: ${snapshot.weather.temperatureC}C  |  Humidity: ${snapshot.weather.humidityPct}%  |  Wind: ${snapshot.weather.windSpeedKmh} km/h`,
      56,
      365,
    );

    ctx.fillStyle = '#64748B';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Updated ${new Date(snapshot.updatedAt).toUTCString()}`, 56, 435);

    const link = document.createElement('a');
    link.download = `vayumitra-${snapshot.location.name.toLowerCase().replace(/\s+/g, '-')}-aqi.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(summaryText)}&url=${encodeURIComponent(shareUrl)}`;
  const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share Air Quality Snapshot"
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-lg w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Share Air Quality Snapshot
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E17] text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {summaryText}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-sky-500 dark:hover:border-cyan-400 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                <span>Copied Summary</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>Copy Report Text</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadCard}
            className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-sky-500 dark:hover:border-cyan-400 cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Download PNG Card</span>
          </button>

          <button
            type="button"
            onClick={handleNativeShare}
            className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 cursor-pointer sm:col-span-2"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
            <span>Share via Device Sheet</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-6 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs font-medium">
          <a
            href={xHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 dark:text-cyan-400 hover:underline"
          >
            Post on X
          </a>
          <a
            href={linkedInHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 dark:text-cyan-400 hover:underline"
          >
            Share on LinkedIn
          </a>
        </div>
      </div>
    </div>
  );
}
