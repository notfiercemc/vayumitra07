import { Leaf, RotateCcw } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import type { CarbonFootprintInputs, CarbonFootprintResult } from '../../types/airQuality.ts';
import {
  calculateCarbonFootprint,
  DEFAULT_CARBON_INPUTS,
} from '../../utils/carbonCalculator.ts';

interface CarbonFootprintToolProps {
  inputs: CarbonFootprintInputs;
  onChangeInputs: (next: CarbonFootprintInputs) => void;
  onResultChange?: (result: CarbonFootprintResult) => void;
}

export function CarbonFootprintTool({
  inputs,
  onChangeInputs,
  onResultChange,
}: CarbonFootprintToolProps) {
  const result = useMemo(() => calculateCarbonFootprint(inputs), [inputs]);

  useEffect(() => {
    onResultChange?.(result);
  }, [result, onResultChange]);

  const segments = [
    { label: 'Transport', value: result.breakdown.transport, color: '#06b6d4' },
    { label: 'Flights', value: result.breakdown.flights, color: '#f59e0b' },
    { label: 'Home Energy', value: result.breakdown.homeEnergy, color: '#6366f1' },
    { label: 'Diet', value: result.breakdown.diet, color: '#10b981' },
    { label: 'Waste', value: result.breakdown.waste, color: '#94a3b8' },
  ];

  const total = Math.max(0.1, result.totalTonnesCo2e);
  const dailyKg = Math.round((result.totalTonnesCo2e * 1000) / 365 * 10) / 10;
  const parisDailyKg = 5.5;
  const globalAvgTonnes = 4.8;

  const applyReductionTip = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes('car trips')) {
      onChangeInputs({
        ...inputs,
        carKmPerWeek: Math.round(inputs.carKmPerWeek * 0.5),
        publicTransitKmPerWeek: inputs.publicTransitKmPerWeek + Math.round(inputs.carKmPerWeek * 0.4),
      });
    } else if (lower.includes('green electricity')) {
      onChangeInputs({ ...inputs, renewableSharePct: 100 });
    } else if (lower.includes('long-haul')) {
      onChangeInputs({
        ...inputs,
        longFlightsPerYear: Math.max(0, inputs.longFlightsPerYear - 1),
      });
    } else if (lower.includes('vegetarian')) {
      onChangeInputs({ ...inputs, dietType: 'vegetarian' });
    } else if (lower.includes('recycling')) {
      onChangeInputs({ ...inputs, recyclingRatePct: 90 });
    }
  };

  return (
    <section
      aria-label="Integrated carbon footprint calculator"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Personal Sustainability &amp; Emissions Modeling
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mt-0.5">
            Carbon Footprint Calculator
          </h2>
        </div>

        <button
          type="button"
          onClick={() => onChangeInputs(DEFAULT_CARBON_INPUTS)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-sky-500 dark:hover:border-cyan-400 self-start cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reset Defaults</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Inputs */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
            <label htmlFor="cf-vehicle" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Primary Vehicle Type
            </label>
            <select
              id="cf-vehicle"
              value={inputs.vehicleType}
              onChange={(e) =>
                onChangeInputs({
                  ...inputs,
                  vehicleType: e.target.value as CarbonFootprintInputs['vehicleType'],
                })
              }
              className="w-full min-h-[40px] px-2.5 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            >
              <option value="petrol">Petrol / Gasoline Car</option>
              <option value="diesel">Diesel Car</option>
              <option value="hybrid">Hybrid Electric</option>
              <option value="ev">Battery Electric (EV)</option>
              <option value="none">No Personal Car</option>
            </select>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
            <div className="flex justify-between text-xs mb-1.5">
              <label htmlFor="cf-carkm" className="font-medium text-slate-700 dark:text-slate-300">
                Weekly Car Distance
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-cyan-300">
                {inputs.carKmPerWeek} km
              </span>
            </div>
            <input
              id="cf-carkm"
              type="range"
              min={0}
              max={600}
              step={10}
              disabled={inputs.vehicleType === 'none'}
              value={inputs.carKmPerWeek}
              onChange={(e) =>
                onChangeInputs({ ...inputs, carKmPerWeek: Number(e.target.value) })
              }
              className="w-full accent-sky-600 dark:accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
            <div className="flex justify-between text-xs mb-1.5">
              <label htmlFor="cf-transit" className="font-medium text-slate-700 dark:text-slate-300">
                Weekly Public Transit
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-cyan-300">
                {inputs.publicTransitKmPerWeek} km
              </span>
            </div>
            <input
              id="cf-transit"
              type="range"
              min={0}
              max={300}
              step={5}
              value={inputs.publicTransitKmPerWeek}
              onChange={(e) =>
                onChangeInputs({ ...inputs, publicTransitKmPerWeek: Number(e.target.value) })
              }
              className="w-full accent-sky-600 dark:accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
            <div className="flex justify-between text-xs mb-1.5">
              <label htmlFor="cf-elec" className="font-medium text-slate-700 dark:text-slate-300">
                Monthly Home Electricity
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-cyan-300">
                {inputs.electricityKwhPerMonth} kWh
              </span>
            </div>
            <input
              id="cf-elec"
              type="range"
              min={50}
              max={1200}
              step={25}
              value={inputs.electricityKwhPerMonth}
              onChange={(e) =>
                onChangeInputs({ ...inputs, electricityKwhPerMonth: Number(e.target.value) })
              }
              className="w-full accent-sky-600 dark:accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
            <div className="flex justify-between text-xs mb-1.5">
              <label htmlFor="cf-renew" className="font-medium text-slate-700 dark:text-slate-300">
                Renewable Grid / Solar Share
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-cyan-300">
                {inputs.renewableSharePct}%
              </span>
            </div>
            <input
              id="cf-renew"
              type="range"
              min={0}
              max={100}
              step={5}
              value={inputs.renewableSharePct}
              onChange={(e) =>
                onChangeInputs({ ...inputs, renewableSharePct: Number(e.target.value) })
              }
              className="w-full accent-sky-600 dark:accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
            <div className="flex justify-between text-xs mb-1.5">
              <label htmlFor="cf-recycle" className="font-medium text-slate-700 dark:text-slate-300">
                Recycling &amp; Composting
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-cyan-300">
                {inputs.recyclingRatePct}%
              </span>
            </div>
            <input
              id="cf-recycle"
              type="range"
              min={0}
              max={100}
              step={5}
              value={inputs.recyclingRatePct}
              onChange={(e) =>
                onChangeInputs({ ...inputs, recyclingRatePct: Number(e.target.value) })
              }
              className="w-full accent-sky-600 dark:accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
            <label htmlFor="cf-diet" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Dietary Pattern
            </label>
            <select
              id="cf-diet"
              value={inputs.dietType}
              onChange={(e) =>
                onChangeInputs({
                  ...inputs,
                  dietType: e.target.value as CarbonFootprintInputs['dietType'],
                })
              }
              className="w-full min-h-[40px] px-2.5 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            >
              <option value="meat_heavy">Frequent Red Meat</option>
              <option value="balanced">Balanced Omnivore</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Plant-Based / Vegan</option>
            </select>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="cf-short" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Short Flights/yr
                </label>
                <input
                  id="cf-short"
                  type="number"
                  min={0}
                  max={40}
                  value={inputs.shortFlightsPerYear}
                  onChange={(e) =>
                    onChangeInputs({
                      ...inputs,
                      shortFlightsPerYear: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-full min-h-[40px] px-2.5 py-1 text-sm font-mono tabular-nums rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="cf-long" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Long Flights/yr
                </label>
                <input
                  id="cf-long"
                  type="number"
                  min={0}
                  max={30}
                  value={inputs.longFlightsPerYear}
                  onChange={(e) =>
                    onChangeInputs({
                      ...inputs,
                      longFlightsPerYear: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-full min-h-[40px] px-2.5 py-1 text-sm font-mono tabular-nums rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Scoreboard, Daily/Annual Benchmarks & Interactive Reduction Tips */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17] space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Estimated Footprint
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                    {result.totalTonnesCo2e}
                  </span>
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    tCO₂e/yr ({dailyKg} kg/day)
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {result.vsParisTargetDelta <= 0
                    ? `Within 2.0 t Paris target (${parisDailyKg} kg/day) by ${Math.abs(result.vsParisTargetDelta)} t`
                    : `${result.vsParisTargetDelta} t above 2.0 t Paris target · Global avg: ${globalAvgTonnes} t/yr`}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Sustainability Score
                </div>
                <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {result.sustainabilityScore}/100
                </div>
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {result.gradeLabel}
                </div>
              </div>
            </div>

            {/* Goal Benchmark Bars */}
            <div className="space-y-1.5 text-[11px] font-mono tabular-nums">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>You ({result.totalTonnesCo2e} t/yr)</span>
                <span>Paris Target (2.0 t) · Global Avg ({globalAvgTonnes} t)</span>
              </div>
              <div className="relative h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    result.totalTonnesCo2e <= 2.0
                      ? 'bg-emerald-500'
                      : result.totalTonnesCo2e <= globalAvgTonnes
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((result.totalTonnesCo2e / 10) * 100))}%` }}
                />
                <div
                  title="Paris 2.0 t/yr Target"
                  className="absolute top-0 bottom-0 w-0.5 bg-emerald-400"
                  style={{ left: '20%' }}
                />
                <div
                  title="Global Avg 4.8 t/yr"
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                  style={{ left: '48%' }}
                />
              </div>
            </div>

            {/* Stacked Category Bar */}
            <div>
              <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-800">
                {segments.map((seg) => (
                  <div
                    key={seg.label}
                    style={{
                      width: `${Math.max(2, (seg.value / total) * 100)}%`,
                      backgroundColor: seg.color,
                    }}
                    title={`${seg.label}: ${seg.value} tCO₂e`}
                  />
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {segments.map((seg) => (
                  <div key={seg.label} className="flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: seg.color }}
                        aria-hidden="true"
                      />
                      <span>{seg.label}</span>
                    </span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {seg.value}t
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17] space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
              <span>Highest-Impact Reduction Actions (Click to Simulate)</span>
            </h3>
            {result.topActions.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Your current profile already reflects low-emission choices across transport, energy, and diet.
              </p>
            ) : (
              <ul className="space-y-2">
                {result.topActions.map((act) => (
                  <li
                    key={act.title}
                    className="flex items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <span className="flex-1">{act.title}</span>
                    <button
                      type="button"
                      onClick={() => applyReductionTip(act.title)}
                      className="px-2.5 py-1 min-h-[28px] rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono tabular-nums font-semibold hover:bg-emerald-500/20 shrink-0 cursor-pointer transition-colors"
                    >
                      Apply (-{act.estimatedReductionTonnes}t)
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
