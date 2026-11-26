import { WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { EnvironmentalAssistantDrawer } from './components/chat/EnvironmentalAssistantDrawer.tsx';
import { CarbonFootprintTool } from './components/climate/CarbonFootprintTool.tsx';
import { ClimateNewsGrid } from './components/climate/ClimateNewsGrid.tsx';
import { ShareReportModal } from './components/common/ShareReportModal.tsx';
import { CommunityReportsPanel } from './components/community/CommunityReportsPanel.tsx';
import { CurrentConditionsPanel } from './components/dashboard/CurrentConditionsPanel.tsx';
import { LocationToolbar } from './components/dashboard/LocationToolbar.tsx';
import { AqiForecastChart } from './components/forecast/AqiForecastChart.tsx';
import { HealthAdvisoriesSection } from './components/health/HealthAdvisoriesSection.tsx';
import { TopNav, type ActiveSection } from './components/layout/TopNav.tsx';
import { GlobalAqiMap } from './components/map/GlobalAqiMap.tsx';
import { getAirQualitySnapshot, getGlobalHubs, reverseGeocode } from './services/apiClient.ts';
import type {
  AirQualitySnapshot,
  CarbonFootprintInputs,
  CarbonFootprintResult,
  GeoLocation,
  GlobalHubPin,
} from './types/airQuality.ts';
import { DEFAULT_CARBON_INPUTS } from './utils/carbonCalculator.ts';

const DEFAULT_LOCATION: GeoLocation = {
  id: '28.6139,77.2090',
  name: 'New Delhi',
  country: 'India',
  latitude: 28.6139,
  longitude: 77.209,
};

const SECTION_ORDER: ActiveSection[] = ['overview', 'forecast', 'health', 'community', 'climate'];

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [selectedLocation, setSelectedLocation] = useState<GeoLocation>(DEFAULT_LOCATION);
  const [snapshot, setSnapshot] = useState<AirQualitySnapshot | null>(null);
  const [hubs, setHubs] = useState<GlobalHubPin[]>([]);
  const [hubsError, setHubsError] = useState<string | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const [carbonInputs, setCarbonInputs] = useState<CarbonFootprintInputs>(DEFAULT_CARBON_INPUTS);
  const [carbonResult, setCarbonResult] = useState<CarbonFootprintResult | null>(null);

  // Sync dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [isDark]);

  // Network online/offline listeners
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Scroll spy for TopNav active section state
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace('section-', '') as ActiveSection;
            if (SECTION_ORDER.includes(id)) {
              setActiveSection(id);
            }
          }
        }
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: 0.05 },
    );

    for (const sec of SECTION_ORDER) {
      const el = document.getElementById(`section-${sec}`);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const loadHubs = useCallback(async () => {
    setHubsError(null);
    try {
      const res = await getGlobalHubs();
      setHubs(res.hubs);
    } catch (err) {
      setHubsError(err instanceof Error ? err.message : 'Unable to reach global AQI hubs.');
    }
  }, []);

  useEffect(() => {
    loadHubs();
  }, [loadHubs]);

  const loadSnapshot = useCallback(async (loc: GeoLocation) => {
    setIsLoadingSnapshot(true);
    setSnapshotError(null);
    try {
      const res = await getAirQualitySnapshot(loc);
      setSnapshot(res.snapshot);
    } catch (err) {
      setSnapshotError(
        err instanceof Error ? err.message : 'Unable to retrieve air quality telemetry.',
      );
    } finally {
      setIsLoadingSnapshot(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot(selectedLocation);
  }, [selectedLocation, loadSnapshot]);

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setSnapshotError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lon = Math.round(pos.coords.longitude * 10000) / 10000;
        const resolved = await reverseGeocode(lat, lon);
        setSelectedLocation(resolved);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setSnapshotError('Location permission denied. Search for any city above instead.');
      },
      { timeout: 8000 },
    );
  }, []);

  const handleSelectSection = (section: ActiveSection) => {
    setActiveSection(section);
    const el = document.getElementById(`section-${section}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#07090E] text-slate-900 dark:text-slate-100">
      {/* WCAG 2.1 AA Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-cyan-500 focus:text-slate-950 focus:font-semibold"
      >
        Skip to main dashboard content
      </a>

      <TopNav
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        onOpenAssistant={() => setIsAssistantOpen(true)}
      />

      <LocationToolbar
        selectedLocation={selectedLocation}
        onSelectLocation={setSelectedLocation}
        onUseCurrentLocation={handleUseCurrentLocation}
        isLocating={isLocating}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onOpenShare={() => setIsShareOpen(true)}
      />

      {!isOnline && (
        <div
          role="status"
          className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center justify-center gap-2"
        >
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            Offline mode active. Displaying locally cached atmospheric snapshots; new community reports will sync automatically when reconnected.
          </span>
        </div>
      )}

      <main
        id="main-content"
        className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8"
      >
        {/* Overview: Interactive Global Map + Current Conditions & Weather */}
        <section
          id="section-overview"
          aria-label="Air quality overview and global map"
          className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch scroll-mt-24"
        >
          <div className="xl:col-span-6 flex flex-col">
            <GlobalAqiMap
              hubs={hubs}
              hubsError={hubsError}
              onRetryHubs={loadHubs}
              activeSnapshot={snapshot}
              isDark={isDark}
              onSelectCoordinates={setSelectedLocation}
            />
          </div>
          <div className="xl:col-span-6 flex flex-col">
            <CurrentConditionsPanel
              snapshot={snapshot}
              isLoading={isLoadingSnapshot}
              error={snapshotError}
              onRetry={() => loadSnapshot(selectedLocation)}
              onOpenAssistant={() => setIsAssistantOpen(true)}
            />
          </div>
        </section>

        {/* Predictive AQI Forecasting Model */}
        <div id="section-forecast" className="scroll-mt-24">
          <AqiForecastChart snapshot={snapshot} />
        </div>

        {/* Dynamic Vulnerable Group Health Advisories */}
        <div id="section-health" className="scroll-mt-24">
          <HealthAdvisoriesSection
            snapshot={snapshot}
            onOpenAssistant={() => setIsAssistantOpen(true)}
          />
        </div>

        {/* Community Pollution Reporting with Photo Uploads */}
        <div id="section-community" className="scroll-mt-24">
          <CommunityReportsPanel selectedLocation={selectedLocation} />
        </div>

        {/* Climate News & Carbon Footprint Calculator */}
        <div id="section-climate" className="space-y-8 scroll-mt-24">
          <CarbonFootprintTool
            inputs={carbonInputs}
            onChangeInputs={setCarbonInputs}
            onResultChange={setCarbonResult}
          />
          <ClimateNewsGrid />
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0B0E17] py-6">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
          <span>
            VayuMitra Urban Air Quality Assistant · Data fused from OpenAQ, Copernicus CAMS, and Open-Meteo
          </span>
          <span>
            WCAG 2.1 AA Accessible · Offline Snapshot Caching Enabled
          </span>
        </div>
      </footer>

      <EnvironmentalAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        snapshot={snapshot}
        carbonResult={carbonResult}
      />

      <ShareReportModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        snapshot={snapshot}
      />
    </div>
  );
}
