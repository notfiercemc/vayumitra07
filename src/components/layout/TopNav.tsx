import { MessageSquare } from 'lucide-react';

export type ActiveSection = 'overview' | 'forecast' | 'health' | 'community' | 'climate';

interface TopNavProps {
  activeSection: ActiveSection;
  onSelectSection: (section: ActiveSection) => void;
  onOpenAssistant: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveSection; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'health', label: 'Health' },
  { id: 'community', label: 'Community' },
  { id: 'climate', label: 'Climate & Carbon' },
];

export function TopNav({ activeSection, onSelectSection, onOpenAssistant }: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#07090E]/95 backdrop-blur-md">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectSection('overview');
          }}
          className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0"
        >
          VayuMitra
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav aria-label="Primary sections" className="hidden md:flex items-center gap-6 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`py-5 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-sky-600 text-slate-900 dark:border-cyan-400 dark:text-slate-50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenAssistant}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-sky-600 hover:bg-sky-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
          >
            <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Ask Assistant</span>
          </button>
        </div>
      </div>

      {/* Mobile horizontal navigation bar */}
      <nav
        aria-label="Mobile section navigation"
        className="md:hidden flex items-center gap-4 px-4 overflow-x-auto border-t border-slate-200 dark:border-slate-800/80"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                isActive
                  ? 'border-sky-600 text-slate-900 dark:border-cyan-400 dark:text-slate-50'
                  : 'border-transparent text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
