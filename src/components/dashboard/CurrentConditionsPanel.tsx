import { AlertCircle, Compass, Droplets, Eye, Gauge, MessageSquare, RefreshCw, Sun, Thermometer, Wind } from 'lucide-react';
import { getAqiLevel, POLLUTANT_META } from '../../constants/aqiScale.ts';
import type { AirQualitySnapshot } from '../../types/airQuality.ts';

interface CurrentConditionsPanelProps {
  snapshot: AirQualitySnapshot | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenAssistant: () => void;
}

export function CurrentConditionsPanel({
  snapshot,
  isLoading,
  error,
  onRetry,
  onOpenAssistant,
}: CurrentConditionsPanelProps) {
  if (isLoading && !snapshot) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading air quality telemetry"
        className="h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 space-y-6 animate-pulse"
      >
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-20 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div
        role="alert"
        className="h-full rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 flex flex-col items-start justify-center gap-3"
      >
        <div className="inline-flex items-center gap-2 text-rose-700 dark:text-rose-300 font-semibold">
          <AlertCircle className="w-5 h-5" aria-hidden="true" />
          <span>Atmospheric Telemetry Unavailable</span>
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  if (!snapshot) return null;

  const level = getAqiLevel(snapshot.aqi);
  const dominantMeta = POLLUTANT_META.find((p) => p.key === snapshot.dominantPollutant);

  return (
    <div className="h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 flex flex-col justify-between gap-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-300"
        >
          <span>Live refresh warning: {error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="underline font-semibold shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Location & Hero AQI Score */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>{snapshot.stationName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {snapshot.location.latitude.toFixed(2)}°, {snapshot.location.longitude.toFixed(2)}°
            </span>
            <span aria-hidden="true">·</span>
            <span className={snapshot.fromCache ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-emerald-700 dark:text-emerald-400 font-medium'}>
              {snapshot.fromCache ? 'Cached Snapshot' : 'Live Feed'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate">
            {snapshot.location.name}, {snapshot.location.country}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-prose">
            {level.summary}
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-cyan-400 hover:underline cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{isLoading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
            </button>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">|</span>
            <button
              type="button"
              onClick={onOpenAssistant}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-cyan-400 hover:underline cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Ask AI about {snapshot.location.name}</span>
            </button>
          </div>
        </div>

        <div
          aria-live="polite"
          className={`shrink-0 rounded-xl border ${level.borderClass} ${level.bgSubtleClass} px-5 py-4 min-w-[180px]`}
        >
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
            US Air Quality Index
          </div>
          <div className="flex items-baseline gap-2.5 mt-1">
            <span
              className="text-4xl sm:text-5xl font-bold font-mono tabular-nums tracking-tight"
              style={{ color: level.hex }}
            >
              {snapshot.aqi}
            </span>
            <span className={`text-sm font-semibold ${level.textClass}`}>
              <span aria-hidden="true" className="mr-1">
                {level.symbol}
              </span>
              {level.shortLabel}
            </span>
          </div>
          <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            Primary driver: <span className="font-semibold text-slate-800 dark:text-slate-200">{dominantMeta?.formula ?? 'PM₂.₅'}</span>
          </div>
        </div>
      </div>

      {/* Weather Atmospheric Telemetry Strip */}
      <div>
        <h3 className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-400 mb-3">
          Atmospheric &amp; Meteorological Telemetry
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <TelemetryItem
            icon={<Thermometer className="w-4 h-4 text-amber-500" aria-hidden="true" />}
            label="Temperature"
            value={`${snapshot.weather.temperatureC}°C`}
            sub={`Feels like ${snapshot.weather.apparentTemperatureC}°C`}
          />
          <TelemetryItem
            icon={<Droplets className="w-4 h-4 text-sky-500" aria-hidden="true" />}
            label="Relative Humidity"
            value={`${snapshot.weather.humidityPct}%`}
            sub={snapshot.weather.conditionLabel}
          />
          <TelemetryItem
            icon={<Wind className="w-4 h-4 text-cyan-500" aria-hidden="true" />}
            label="Wind & Dispersion"
            value={`${snapshot.weather.windSpeedKmh} km/h`}
            sub={`Gusts ${snapshot.weather.windGustsKmh} km/h`}
          />
          <TelemetryItem
            icon={<Compass className="w-4 h-4 text-slate-400" aria-hidden="true" />}
            label="Wind Bearing"
            value={`${snapshot.weather.windDirectionDeg}°`}
            sub={bearingToCompass(snapshot.weather.windDirectionDeg)}
          />
          <TelemetryItem
            icon={<Gauge className="w-4 h-4 text-emerald-500" aria-hidden="true" />}
            label="Surface Pressure"
            value={`${snapshot.weather.surfacePressureHpa} hPa`}
            sub={`Cloud cover ${snapshot.weather.cloudCoverPct}%`}
          />
          <TelemetryItem
            icon={
              snapshot.weather.visibilityKm !== null ? (
                <Eye className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              ) : (
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              )
            }
            label="UV & Visibility"
            value={`UV ${snapshot.weather.uvIndex}`}
            sub={
              snapshot.weather.visibilityKm !== null
                ? `Vis ${snapshot.weather.visibilityKm} km`
                : 'Clear horizon'
            }
          />
        </div>
      </div>

      {/* 6-Pollutant Breakdown vs WHO Guidelines */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-400">
            Pollutant Concentrations vs WHO 24-Hour Guidelines
          </h3>
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {snapshot.source === 'openaq+open-meteo' ? 'OpenAQ Ground + CAMS' : 'Copernicus CAMS'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {POLLUTANT_META.map((meta) => {
            const val = snapshot.pollutants[meta.key];
            const ratio = val !== null ? Math.min(100, Math.round((val / (meta.who24hGuideline * 2)) * 100)) : 0;
            const exceedsWho = val !== null && val > meta.who24hGuideline;

            return (
              <div
                key={meta.key}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {meta.formula}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      exceedsWho
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {val === null ? 'N/A' : exceedsWho ? 'Above WHO' : 'Within WHO'}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                    {val !== null ? val : '--'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                    {meta.unit}
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={val ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={meta.who24hGuideline * 2}
                  aria-label={`${meta.name} concentration`}
                >
                  <div
                    className={`h-full rounded-full transition-all ${
                      exceedsWho ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(val !== null ? 6 : 0, ratio)}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                  WHO limit: {meta.who24hGuideline} {meta.unit}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TelemetryItem({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-base font-semibold font-mono tabular-nums text-slate-900 dark:text-slate-100">
        {value}
      </div>
      <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{sub}</div>
    </div>
  );
}

function bearingToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return `${dirs[Math.round(deg / 45) % 8]} Flow`;
}
