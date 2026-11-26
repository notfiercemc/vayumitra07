import { LocateFixed, Moon, Search, Share2, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { searchLocations } from '../../services/apiClient.ts';
import type { GeoLocation } from '../../types/airQuality.ts';

interface LocationToolbarProps {
  selectedLocation: GeoLocation;
  onSelectLocation: (loc: GeoLocation) => void;
  onUseCurrentLocation: () => void;
  isLocating: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenShare: () => void;
}

const PRESET_LOCATIONS: GeoLocation[] = [
  { id: '28.6139,77.2090', name: 'New Delhi', country: 'India', latitude: 28.6139, longitude: 77.209 },
  { id: '51.5072,-0.1276', name: 'London', country: 'United Kingdom', latitude: 51.5072, longitude: -0.1276 },
  { id: '40.7128,-74.0060', name: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.006 },
  { id: '35.6762,139.6503', name: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503 },
  { id: '39.9042,116.4074', name: 'Beijing', country: 'China', latitude: 39.9042, longitude: 116.4074 },
  { id: '-23.5505,-46.6333', name: 'São Paulo', country: 'Brazil', latitude: -23.5505, longitude: -46.6333 },
];

export function LocationToolbar({
  selectedLocation,
  onSelectLocation,
  onUseCurrentLocation,
  isLocating,
  isDark,
  onToggleTheme,
  onOpenShare,
}: LocationToolbarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoLocation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const list = await searchLocations(trimmed);
        setResults(list);
        setActiveIndex(list.length > 0 ? 0 : -1);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query]);

  const handleChoose = (loc: GeoLocation) => {
    onSelectLocation(loc);
    setQuery('');
    setIsOpen(false);
    setResults([]);
  };

  return (
    <section
      aria-label="Global location search and display controls"
      className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#0B0E17]"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Search + Geolocation */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
          <div ref={containerRef} className="relative w-full sm:max-w-sm">
            <label htmlFor="global-city-search" className="sr-only">
              Search any city or region worldwide
            </label>
            <div className="relative flex items-center">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="global-city-search"
                type="text"
                role="combobox"
                aria-expanded={isOpen && results.length > 0}
                aria-controls="location-search-listbox"
                aria-autocomplete="list"
                value={query}
                onFocus={() => setIsOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                }}
                onKeyDown={(e) => {
                  if (!isOpen || results.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveIndex((prev) => (prev + 1) % results.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
                  } else if (e.key === 'Enter' && activeIndex >= 0) {
                    e.preventDefault();
                    handleChoose(results[activeIndex]);
                  } else if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
                placeholder="Search any city worldwide (e.g., Tokyo, Paris)..."
                className="w-full min-h-[40px] pl-9 pr-8 py-2 text-sm rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-sky-500 dark:focus:border-cyan-400 transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                  }}
                  aria-label="Clear search query"
                  className="absolute right-2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {isOpen && query.trim().length >= 2 && (
              <ul
                id="location-search-listbox"
                role="listbox"
                className="absolute z-50 mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-xl max-h-72 overflow-y-auto py-1"
              >
                {isSearching && (
                  <li className="px-3.5 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                    Searching global stations...
                  </li>
                )}
                {!isSearching && results.length === 0 && (
                  <li className="px-3.5 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                    No matching cities found. Try a broader city name.
                  </li>
                )}
                {!isSearching &&
                  results.map((loc, idx) => (
                    <li
                      key={loc.id}
                      role="option"
                      aria-selected={idx === activeIndex}
                    >
                      <button
                        type="button"
                        onClick={() => handleChoose(loc)}
                        className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          idx === activeIndex
                            ? 'bg-sky-50 dark:bg-slate-800 text-slate-900 dark:text-white'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="truncate font-medium">
                          {loc.name}
                          {loc.admin1 ? `, ${loc.admin1}` : ''}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                          {loc.country}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={isLocating}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200 hover:border-sky-500 dark:hover:border-cyan-500/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <LocateFixed className="w-4 h-4 text-sky-600 dark:text-cyan-400" aria-hidden="true" />
            <span>{isLocating ? 'Locating...' : 'My Location'}</span>
          </button>

          {/* Quick preset station buttons */}
          <div
            role="group"
            aria-label="Quick city stations"
            className="hidden xl:flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-[#111827] border border-slate-200 dark:border-slate-800"
          >
            {PRESET_LOCATIONS.map((preset) => {
              const active =
                Math.abs(preset.latitude - selectedLocation.latitude) < 0.08 &&
                Math.abs(preset.longitude - selectedLocation.longitude) < 0.08;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSelectLocation(preset)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-cyan-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Share + Theme Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenShare}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200 hover:border-sky-500 dark:hover:border-cyan-500/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
            <span>Share Report</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[40px] min-w-[40px] text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] text-slate-700 dark:text-slate-200 hover:border-sky-500 dark:hover:border-cyan-500/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isDark ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-sky-600" aria-hidden="true" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
