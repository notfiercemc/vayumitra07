import type {
  AirQualitySnapshot,
  ChatMessage,
  ClimateNewsArticle,
  CommunityReport,
  GeoLocation,
  GlobalHubPin,
} from '../types/airQuality.ts';
import { offlineCache } from './offlineCache.ts';

async function fetchJsonWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        typeof (data as { error?: string }).error === 'string'
          ? (data as { error: string }).error
          : `Request failed (HTTP ${res.status})`;
      throw new Error(msg);
    }
    return data as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Network timeout while contacting atmospheric telemetry servers.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function searchLocations(query: string): Promise<GeoLocation[]> {
  const res = await fetchJsonWithTimeout<{ results: GeoLocation[] }>(
    `/api/geocode?q=${encodeURIComponent(query)}`,
  );
  return res.results;
}

export async function reverseGeocode(lat: number, lon: number): Promise<GeoLocation> {
  try {
    const res = await fetchJsonWithTimeout<{ location: GeoLocation }>(
      `/api/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
      {},
      5000,
    );
    return res.location;
  } catch {
    return {
      id: `${lat.toFixed(4)},${lon.toFixed(4)}`,
      name: `Pin (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
      country: 'Coordinates',
      latitude: lat,
      longitude: lon,
    };
  }
}

export async function getGlobalHubs(): Promise<{ hubs: GlobalHubPin[]; isOfflineFallback: boolean }> {
  try {
    const res = await fetchJsonWithTimeout<{ hubs: GlobalHubPin[] }>('/api/global-hubs');
    offlineCache.saveHubs(res.hubs);
    return { hubs: res.hubs, isOfflineFallback: false };
  } catch (err) {
    const cached = offlineCache.getHubs();
    if (cached) {
      return { hubs: cached.data, isOfflineFallback: true };
    }
    throw err;
  }
}

export async function getAirQualitySnapshot(
  location: GeoLocation,
): Promise<{ snapshot: AirQualitySnapshot; isOfflineFallback: boolean; cachedAt?: string }> {
  try {
    const params = new URLSearchParams({
      lat: String(location.latitude),
      lon: String(location.longitude),
      name: location.name,
      country: location.country,
    });
    const snapshot = await fetchJsonWithTimeout<AirQualitySnapshot>(
      `/api/air-quality?${params.toString()}`,
    );
    offlineCache.saveSnapshot(snapshot);
    return { snapshot, isOfflineFallback: false };
  } catch (err) {
    const cached = offlineCache.getSnapshot(location.latitude, location.longitude);
    if (cached) {
      return {
        snapshot: { ...cached.data, fromCache: true },
        isOfflineFallback: true,
        cachedAt: cached.cachedAt,
      };
    }
    throw err;
  }
}

export async function getClimateNews(): Promise<{
  articles: ClimateNewsArticle[];
  isOfflineFallback: boolean;
}> {
  try {
    const res = await fetchJsonWithTimeout<{ articles: ClimateNewsArticle[] }>('/api/news');
    offlineCache.saveNews(res.articles);
    return { articles: res.articles, isOfflineFallback: false };
  } catch (err) {
    const cached = offlineCache.getNews();
    if (cached) {
      return { articles: cached.data, isOfflineFallback: true };
    }
    throw err;
  }
}

export async function getCommunityReports(): Promise<CommunityReport[]> {
  try {
    const res = await fetchJsonWithTimeout<{ reports: CommunityReport[] }>('/api/reports');
    offlineCache.saveReports(res.reports);
    const pending = offlineCache.getPendingReports();
    return [...pending, ...res.reports];
  } catch {
    const cached = offlineCache.getReports()?.data ?? [];
    const pending = offlineCache.getPendingReports();
    return [...pending, ...cached];
  }
}

export async function submitCommunityReport(payload: {
  title: string;
  category: CommunityReport['category'];
  severity: CommunityReport['severity'];
  description: string;
  locationName: string;
  latitude: number;
  longitude: number;
  photoDataUrl: string | null;
  reporterName: string;
}): Promise<{ report: CommunityReport; queuedOffline: boolean }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineReport: CommunityReport = {
      ...payload,
      id: `pending-${Date.now()}`,
      upvotes: 1,
      createdAt: new Date().toISOString(),
      pendingSync: true,
    };
    offlineCache.queueOfflineReport(offlineReport);
    return { report: offlineReport, queuedOffline: true };
  }

  const res = await fetchJsonWithTimeout<{ report: CommunityReport }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { report: res.report, queuedOffline: false };
}

export async function upvoteReport(id: string): Promise<CommunityReport> {
  const res = await fetchJsonWithTimeout<{ report: CommunityReport }>(
    `/api/reports/${encodeURIComponent(id)}/upvote`,
    { method: 'POST' },
  );
  return res.report;
}

export async function sendAssistantMessage(params: {
  message: string;
  history: ChatMessage[];
  context?: {
    locationName: string;
    aqi: number;
    dominantPollutant: string;
    pm25: number | null;
    temperatureC: number;
    humidityPct: number;
    windSpeedKmh: number;
    carbonTonnesPerYear?: number;
  };
}): Promise<string> {
  const res = await fetchJsonWithTimeout<{ reply: string }>(
    '/api/chat',
    {
      method: 'POST',
      body: JSON.stringify({
        message: params.message,
        history: params.history.map((m) => ({ role: m.role, content: m.content })),
        context: params.context,
      }),
    },
    18000,
  );
  return res.reply;
}
