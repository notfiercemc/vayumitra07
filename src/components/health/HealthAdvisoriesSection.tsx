import { Activity, Baby, HeartPulse, Home, MessageSquare, ShieldAlert, UserCheck, Wind } from 'lucide-react';
import { useState } from 'react';
import { getAqiLevel } from '../../constants/aqiScale.ts';
import type { AirQualitySnapshot, VulnerableGroupAdvice } from '../../types/airQuality.ts';
import { buildVulnerableGroupAdvisories } from '../../utils/healthRecommendations.ts';

interface HealthAdvisoriesSectionProps {
  snapshot: AirQualitySnapshot | null;
  onOpenAssistant: () => void;
}

type CohortFilter = 'all' | 'clinical' | 'family' | 'active';

const GROUP_ICONS: Record<string, React.ReactNode> = {
  children: <Baby className="w-4 h-4 text-sky-500 dark:text-cyan-400" aria-hidden="true" />,
  seniors: <UserCheck className="w-4 h-4 text-amber-500 dark:text-amber-400" aria-hidden="true" />,
  respiratory: <Wind className="w-4 h-4 text-orange-500 dark:text-orange-400" aria-hidden="true" />,
  cardiac: <HeartPulse className="w-4 h-4 text-rose-500 dark:text-rose-400" aria-hidden="true" />,
  pregnant: <ShieldAlert className="w-4 h-4 text-purple-500 dark:text-purple-400" aria-hidden="true" />,
  athletes: <Activity className="w-4 h-4 text-emerald-500 dark:text-emerald-400" aria-hidden="true" />,
};

function riskBadgeStyle(risk: VulnerableGroupAdvice['riskLevel']): string {
  switch (risk) {
    case 'Severe':
      return 'text-rose-700 dark:text-rose-300';
    case 'High':
      return 'text-orange-700 dark:text-orange-300';
    case 'Elevated':
      return 'text-amber-700 dark:text-amber-300';
    case 'Moderate':
      return 'text-sky-700 dark:text-cyan-300';
    default:
      return 'text-emerald-700 dark:text-emerald-400';
  }
}

export function HealthAdvisoriesSection({
  snapshot,
  onOpenAssistant,
}: HealthAdvisoriesSectionProps) {
  const [cohortFilter, setCohortFilter] = useState<CohortFilter>('all');

  if (!snapshot) return null;

  const level = getAqiLevel(snapshot.aqi);
  const { groups, maskGuidance, indoorProtocol, exerciseWindow } =
    buildVulnerableGroupAdvisories(snapshot);

  const visibleGroups = groups.filter((g) => {
    if (cohortFilter === 'all') return true;
    if (cohortFilter === 'clinical') return g.id === 'respiratory' || g.id === 'cardiac';
    if (cohortFilter === 'family') return g.id === 'children' || g.id === 'seniors' || g.id === 'pregnant';
    return g.id === 'athletes';
  });

  return (
    <section
      aria-label="Dynamic health advisories for vulnerable groups"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Calibrated for {snapshot.location.name} · AQI {snapshot.aqi} ({level.label}) · Dominant:{' '}
            {snapshot.dominantPollutant.toUpperCase()}
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mt-0.5">
            Vulnerable Group Health Advisories
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="group"
            aria-label="Filter health advisories by group"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E17] border border-slate-200 dark:border-slate-800"
          >
            {(
              [
                { id: 'all', label: 'All Groups' },
                { id: 'clinical', label: 'Respiratory & Heart' },
                { id: 'family', label: 'Children & Seniors' },
                { id: 'active', label: 'Athletes' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={cohortFilter === tab.id}
                onClick={() => setCohortFilter(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cohortFilter === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-cyan-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onOpenAssistant}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-sky-700 dark:text-cyan-400 hover:border-sky-500 dark:hover:border-cyan-400 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Ask Health Question</span>
          </button>
        </div>
      </div>

      {/* Three Action Protocols */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Respiratory Protection
          </div>
          <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
            {maskGuidance}
          </p>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <Home className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Indoor Air Protocol</span>
          </div>
          <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
            {indoorProtocol}
          </p>
        </div>

        <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0E17]">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Outdoor Activity Window
          </div>
          <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
            {exerciseWindow}
          </p>
        </div>
      </div>

      {/* Vulnerable Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleGroups.map((grp) => (
          <article
            key={grp.id}
            className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-[#0B0E17] flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  {GROUP_ICONS[grp.id]}
                  <span>{grp.groupName}</span>
                </h3>
                <span className={`text-xs font-semibold ${riskBadgeStyle(grp.riskLevel)}`}>
                  {grp.riskLevel} Risk
                </span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {grp.guidance}
              </p>
            </div>
            <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">Action: </span>
              {grp.actionItem}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
