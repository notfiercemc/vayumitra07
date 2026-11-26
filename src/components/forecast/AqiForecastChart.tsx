import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getAqiLevel } from '../../constants/aqiScale.ts';
import type { AirQualitySnapshot } from '../../types/airQuality.ts';
import { generateAqiForecast } from '../../utils/aqiForecast.ts';

interface AqiForecastChartProps {
  snapshot: AirQualitySnapshot | null;
}

export function AqiForecastChart({ snapshot }: AqiForecastChartProps) {
  const [horizon, setHorizon] = useState<12 | 24 | 48>(48);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showDispersionOverlay, setShowDispersionOverlay] = useState(false);

  const summary = useMemo(() => {
    if (!snapshot) return null;
    return generateAqiForecast(snapshot.hourlyHistory, snapshot.upstreamHourlyForecast, horizon);
  }, [snapshot, horizon]);

  if (!snapshot || !summary || summary.points.length === 0) {
    return (
      <section
        aria-label="Predictive AQI forecast"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          Predictive AQI Trajectory
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Select a monitoring location to compute the atmospheric dispersion forecast.
        </p>
      </section>
    );
  }

  const points = summary.points;
  const width = 920;
  const height = 310;
  const padLeft = 46;
  const padRight = 24;
  const padTop = 26;
  const padBottom = 38;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxVal = Math.max(
    120,
    ...points.map((p) => Math.max(p.confidenceHigh, p.observedAqi ?? 0, p.predictedAqi)),
  );
  const yMax = Math.ceil(maxVal / 50) * 50;

  const xForIdx = (i: number) => padLeft + (i / Math.max(1, points.length - 1)) * chartW;
  const yForVal = (v: number) => padTop + chartH - (Math.max(0, v) / yMax) * chartH;

  const splitIndex = points.findIndex((p) => !p.isHistorical);
  const historyPoints = splitIndex === -1 ? points : points.slice(0, splitIndex);
  const forecastStartIdx = Math.max(0, splitIndex - 1);
  const futurePoints = splitIndex === -1 ? [] : points.slice(forecastStartIdx);

  const historyPath = historyPoints
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${xForIdx(idx).toFixed(1)} ${yForVal(pt.observedAqi ?? pt.predictedAqi).toFixed(1)}`)
    .join(' ');

  const forecastPath = futurePoints
    .map((pt, idx) => {
      const globalIdx = forecastStartIdx + idx;
      return `${idx === 0 ? 'M' : 'L'} ${xForIdx(globalIdx).toFixed(1)} ${yForVal(pt.predictedAqi).toFixed(1)}`;
    })
    .join(' ');

  const dispersionPath = showDispersionOverlay
    ? points
        .map((pt, idx) => {
          // Map windDispersionFactor (0.75..1.25) onto chart height for relative comparison
          const scaled = ((pt.windDispersionFactor - 0.7) / 0.6) * (yMax * 0.75);
          return `${idx === 0 ? 'M' : 'L'} ${xForIdx(idx).toFixed(1)} ${yForVal(scaled).toFixed(1)}`;
        })
        .join(' ')
    : '';

  const bandPath =
    futurePoints.length > 1
      ? [
          ...futurePoints.map((pt, idx) => {
            const gIdx = forecastStartIdx + idx;
            return `${idx === 0 ? 'M' : 'L'} ${xForIdx(gIdx).toFixed(1)} ${yForVal(pt.confidenceHigh).toFixed(1)}`;
          }),
          ...futurePoints
            .slice()
            .reverse()
            .map((pt, idx) => {
              const gIdx = forecastStartIdx + (futurePoints.length - 1 - idx);
              return `L ${xForIdx(gIdx).toFixed(1)} ${yForVal(pt.confidenceLow).toFixed(1)}`;
            }),
          'Z',
        ].join(' ')
      : '';

  const activeGlobalIdx = hoverIndex !== null ? hoverIndex : points.length - 1;
  const activePoint = points[activeGlobalIdx];
  const activeLevel = getAqiLevel(activePoint.predictedAqi);
  const peakLevel = getAqiLevel(summary.next24hPeakAqi);
  const yTicks = [0, Math.round(yMax * 0.25), Math.round(yMax * 0.5), Math.round(yMax * 0.75), yMax];

  const activeX = xForIdx(activeGlobalIdx);
  const activeY = yForVal(activePoint.predictedAqi);
  const tooltipLeftPct = Math.min(72, Math.max(4, (activeX / width) * 100 - 10));

  return (
    <section
      aria-label="Predictive AQI Forecasting Model"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>Holt-Winters + Meteorological Dispersion</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Model MAE ±{summary.modelMae} AQI</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mt-0.5">
            Predictive AQI Forecast — {snapshot.location.name}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            aria-pressed={showDispersionOverlay}
            onClick={() => setShowDispersionOverlay((prev) => !prev)}
            className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              showDispersionOverlay
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E17] text-slate-700 dark:text-slate-300 hover:border-sky-500'
            }`}
          >
            {showDispersionOverlay ? 'Hide Dispersion Index' : 'Overlay Dispersion'}
          </button>

          <div
            role="group"
            aria-label="Forecast horizon"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E17] border border-slate-200 dark:border-slate-800"
          >
            {([12, 24, 48] as const).map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={horizon === h}
                onClick={() => {
                  setHorizon(h);
                  setHoverIndex(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  horizon === h
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-cyan-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {h}h Horizon
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
          <div className="text-xs text-slate-600 dark:text-slate-400">Next {horizon}h Peak Forecast</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums" style={{ color: peakLevel.hex }}>
              {summary.next24hPeakAqi}
            </span>
            <span className="text-xs text-slate-700 dark:text-slate-300">
              {peakLevel.symbol} {peakLevel.shortLabel} · {formatShortTime(summary.next24hPeakTime)}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
          <div className="text-xs text-slate-600 dark:text-slate-400">24h Mean Trajectory</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
              {summary.next24hAvgAqi}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
              {summary.trendDirection === 'improving' && (
                <>
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                  <span>Improving</span>
                </>
              )}
              {summary.trendDirection === 'worsening' && (
                <>
                  <TrendingUp className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                  <span>Rising</span>
                </>
              )}
              {summary.trendDirection === 'stable' && (
                <>
                  <Minus className="w-3.5 h-3.5 text-cyan-500" aria-hidden="true" />
                  <span>Steady</span>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
          <div className="text-xs text-slate-600 dark:text-slate-400">Meteorological Driver</div>
          <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {summary.dispersionNote}
          </p>
        </div>
      </div>

      {/* Interactive Chart Container */}
      <div className="relative rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0B0E17] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-slate-400 inline-block" aria-hidden="true" />
              <span>Observed History (48h)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t-2 border-dashed border-cyan-500 inline-block" aria-hidden="true" />
              <span>Projected AQI ({horizon}h)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-cyan-500/20 border border-cyan-500/40 inline-block" aria-hidden="true" />
              <span>95% Confidence Band</span>
            </span>
            {showDispersionOverlay && (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-300">
                <span className="w-4 h-0.5 bg-amber-400 inline-block" aria-hidden="true" />
                <span>Dispersion Multiplier</span>
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Hover or focus chart &amp; press ← / → keys to inspect hours
          </span>
        </div>

        {/* Floating On-Chart Tooltip Readout when inspecting */}
        {hoverIndex !== null && (
          <div
            style={{ left: `${tooltipLeftPct}%` }}
            className="hidden sm:block absolute top-12 z-20 pointer-events-none rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 px-3 py-2 shadow-lg text-xs space-y-0.5"
          >
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {activePoint.isHistorical ? 'Observed History' : 'Model Projection'} · {formatShortTime(activePoint.timestamp)}
            </div>
            <div className="font-mono tabular-nums" style={{ color: activeLevel.hex }}>
              {activeLevel.symbol} AQI {activePoint.predictedAqi} ({activeLevel.shortLabel})
            </div>
            {!activePoint.isHistorical && (
              <div className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                95% CI: {activePoint.confidenceLow}–{activePoint.confidenceHigh} · Dispersion ×{activePoint.windDispersionFactor}
              </div>
            )}
          </div>
        )}

        <svg
          tabIndex={0}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`AQI forecast chart for ${snapshot.location.name} over ${horizon} hours. Use Left and Right arrow keys to inspect hourly points.`}
          className="w-full h-auto select-none cursor-crosshair focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = ((e.clientX - rect.left) / rect.width) * width;
            const norm = Math.max(0, Math.min(1, (relX - padLeft) / chartW));
            setHoverIndex(Math.round(norm * (points.length - 1)));
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              setHoverIndex((prev) => (prev === null ? 0 : Math.min(points.length - 1, prev + 1)));
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setHoverIndex((prev) => (prev === null ? points.length - 1 : Math.max(0, prev - 1)));
            }
          }}
        >
          {/* Projected Zone Shaded Backdrop */}
          {splitIndex > 0 && (
            <rect
              x={xForIdx(splitIndex - 1)}
              y={padTop}
              width={width - padRight - xForIdx(splitIndex - 1)}
              height={chartH}
              fill="rgba(6, 182, 212, 0.04)"
            />
          )}

          {/* Grid lines */}
          {yTicks.map((tick) => {
            const y = yForVal(tick);
            return (
              <g key={tick}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-600 dark:fill-slate-400 text-[10px] font-mono"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Present marker line */}
          {splitIndex > 0 && (
            <g>
              <line
                x1={xForIdx(splitIndex - 1)}
                y1={padTop}
                x2={xForIdx(splitIndex - 1)}
                y2={height - padBottom}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={xForIdx(splitIndex - 1)}
                y={padTop - 8}
                textAnchor="middle"
                className="fill-slate-600 dark:fill-slate-300 text-[10px] font-mono font-semibold"
              >
                Now (Observed | Projected)
              </text>
            </g>
          )}

          {/* 95% confidence band */}
          {bandPath && <path d={bandPath} fill="rgba(6, 182, 212, 0.16)" />}

          {/* Dispersion overlay */}
          {dispersionPath && (
            <path
              d={dispersionPath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />
          )}

          {/* Historical line */}
          <path
            d={historyPath}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />

          {/* Forecast dashed line */}
          {forecastPath && (
            <path
              d={forecastPath}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
              strokeDasharray="5 4"
              strokeLinejoin="round"
            />
          )}

          {/* Crosshair & active point */}
          <line
            x1={activeX}
            y1={padTop}
            x2={activeX}
            y2={height - padBottom}
            stroke="#06b6d4"
            strokeOpacity="0.5"
            strokeWidth="1.2"
          />
          <circle
            cx={activeX}
            cy={activeY}
            r="5"
            fill={activeLevel.hex}
            stroke="#07090E"
            strokeWidth="1.75"
          />

          {/* X-axis labels */}
          {[0, Math.floor(points.length * 0.25), Math.floor(points.length * 0.5), Math.floor(points.length * 0.75), points.length - 1].map(
            (idx) => {
              const pt = points[idx];
              if (!pt) return null;
              return (
                <text
                  key={idx}
                  x={xForIdx(idx)}
                  y={height - 12}
                  textAnchor="middle"
                  className="fill-slate-600 dark:fill-slate-400 text-[10px] font-mono"
                >
                  {pt.hourOffset === 0
                    ? 'Now'
                    : pt.hourOffset > 0
                      ? `+${pt.hourOffset}h`
                      : `${pt.hourOffset}h`}
                </text>
              );
            },
          )}
        </svg>

        {/* Mobile/Always-visible summary bar below chart */}
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
          <span>
            {activePoint.isHistorical ? 'Observed' : 'Projected'} · {formatShortTime(activePoint.timestamp)}
          </span>
          <span style={{ color: activeLevel.hex }} className="font-semibold">
            {activeLevel.symbol} AQI {activePoint.predictedAqi} ({activeLevel.shortLabel})
            {!activePoint.isHistorical ? ` · 95% CI [${activePoint.confidenceLow}–${activePoint.confidenceHigh}]` : ''}
          </span>
        </div>
      </div>
    </section>
  );
}

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
