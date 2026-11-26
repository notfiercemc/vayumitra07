import type {
  AirQualitySnapshot,
  ClimateNewsArticle,
  CommunityReport,
  GlobalHubPin,
} from '../types/airQuality.ts';

interface CachedEnvelope<T> {
  data: T;
  cachedAt: string;
}

const KEYS = {
  snapshotPrefix: 'vm_cache_snapshot_',
  hubs: 'vm_cache_global_hubs',
  news: 'vm_cache_climate_news',
  reports: 'vm_cache_community_reports',
  pendingReports: 'vm_pending_reports_queue',
  lastLocation: 'vm_last_location',
};

function safeRead<T>(key: string): CachedEnvelope<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedEnvelope<T>;
  } catch {
    return null;
  }
}

function safeWrite<T>(key: string, data: T): void {
  try {
    const envelope: CachedEnvelope<T> = {
      data,
      cachedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export const offlineCache = {
  saveSnapshot(snapshot: AirQualitySnapshot): void {
    const key = `${KEYS.snapshotPrefix}${snapshot.location.latitude.toFixed(2)},${snapshot.location.longitude.toFixed(2)}`;
    safeWrite(key, snapshot);
    safeWrite(KEYS.lastLocation, snapshot.location);
  },

  getSnapshot(lat: number, lon: number): CachedEnvelope<AirQualitySnapshot> | null {
    const key = `${KEYS.snapshotPrefix}${lat.toFixed(2)},${lon.toFixed(2)}`;
    return safeRead<AirQualitySnapshot>(key);
  },

  saveHubs(hubs: GlobalHubPin[]): void {
    safeWrite(KEYS.hubs, hubs);
  },

  getHubs(): CachedEnvelope<GlobalHubPin[]> | null {
    return safeRead<GlobalHubPin[]>(KEYS.hubs);
  },

  saveNews(articles: ClimateNewsArticle[]): void {
    safeWrite(KEYS.news, articles);
  },

  getNews(): CachedEnvelope<ClimateNewsArticle[]> | null {
    return safeRead<ClimateNewsArticle[]>(KEYS.news);
  },

  saveReports(reports: CommunityReport[]): void {
    // Strip oversized photos when storing offline list to stay within localStorage budget
    const compact = reports.slice(0, 25);
    safeWrite(KEYS.reports, compact);
  },

  getReports(): CachedEnvelope<CommunityReport[]> | null {
    return safeRead<CommunityReport[]>(KEYS.reports);
  },

  queueOfflineReport(report: CommunityReport): void {
    const existing = safeRead<CommunityReport[]>(KEYS.pendingReports)?.data ?? [];
    safeWrite(KEYS.pendingReports, [report, ...existing].slice(0, 10));
  },

  getPendingReports(): CommunityReport[] {
    return safeRead<CommunityReport[]>(KEYS.pendingReports)?.data ?? [];
  },

  clearPendingReports(): void {
    try {
      window.localStorage.removeItem(KEYS.pendingReports);
    } catch {
      // ignore
    }
  },
};
