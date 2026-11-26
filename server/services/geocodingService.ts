import type { GeoLocation } from '../../src/types/airQuality.ts';
import { MemoryCache, quotaTracker } from '../middleware/rateLimiter.ts';

const geoCache = new MemoryCache<GeoLocation[]>();

const FALLBACK_CITIES: GeoLocation[] = [
  { id: '28.6139,77.2090', name: 'New Delhi', country: 'India', admin1: 'Delhi', latitude: 28.6139, longitude: 77.209 },
  { id: '19.0760,72.8777', name: 'Mumbai', country: 'India', admin1: 'Maharashtra', latitude: 19.076, longitude: 72.8777 },
  { id: '12.9716,77.5946', name: 'Bengaluru', country: 'India', admin1: 'Karnataka', latitude: 12.9716, longitude: 77.5946 },
  { id: '51.5072,-0.1276', name: 'London', country: 'United Kingdom', admin1: 'England', latitude: 51.5072, longitude: -0.1276 },
  { id: '40.7128,-74.0060', name: 'New York', country: 'United States', admin1: 'New York', latitude: 40.7128, longitude: -74.006 },
  { id: '34.0522,-118.2437', name: 'Los Angeles', country: 'United States', admin1: 'California', latitude: 34.0522, longitude: -118.2437 },
  { id: '35.6762,139.6503', name: 'Tokyo', country: 'Japan', admin1: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
  { id: '39.9042,116.4074', name: 'Beijing', country: 'China', admin1: 'Beijing', latitude: 39.9042, longitude: 116.4074 },
  { id: '-23.5505,-46.6333', name: 'São Paulo', country: 'Brazil', admin1: 'São Paulo', latitude: -23.5505, longitude: -46.6333 },
  { id: '-33.8688,151.2093', name: 'Sydney', country: 'Australia', admin1: 'New South Wales', latitude: -33.8688, longitude: 151.2093 },
];

export async function searchGlobalLocations(query: string): Promise<GeoLocation[]> {
  const clean = query.trim();
  if (clean.length < 2) return FALLBACK_CITIES.slice(0, 6);

  const cacheKey = clean.toLowerCase();
  const cached = geoCache.get(cacheKey);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    quotaTracker.recordUpstream('openMeteo');
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=8&language=en&format=json`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Geocoding error: HTTP ${res.status}`);

    const data = (await res.json()) as {
      results?: Array<{
        id: number;
        name: string;
        country?: string;
        admin1?: string;
        latitude: number;
        longitude: number;
        timezone?: string;
      }>;
    };

    const mapped: GeoLocation[] = (data.results ?? []).map((item) => ({
      id: `${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`,
      name: item.name,
      country: item.country || 'Global',
      admin1: item.admin1,
      latitude: item.latitude,
      longitude: item.longitude,
      timezone: item.timezone,
    }));

    geoCache.set(cacheKey, mapped, 30 * 60 * 1000);
    return mapped;
  } catch {
    return FALLBACK_CITIES.filter(
      (c) =>
        c.name.toLowerCase().includes(cacheKey) ||
        c.country.toLowerCase().includes(cacheKey),
    );
  } finally {
    clearTimeout(timeout);
  }
}

const reverseCache = new MemoryCache<GeoLocation>();

export async function reverseGeocodeLocation(
  latitude: number,
  longitude: number,
): Promise<GeoLocation> {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = reverseCache.get(key);
  if (cached) return cached;

  const fallback: GeoLocation = {
    id: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
    name: `Sampled Point (${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°)`,
    country: 'Coordinates',
    latitude,
    longitude,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude.toFixed(4)}&lon=${longitude.toFixed(4)}&zoom=10`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VayuMitra-AirQualityAssistant/1.0',
      },
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        country?: string;
      };
    };
    const addr = json.address;
    const placeName = addr?.city || addr?.town || addr?.village || addr?.state;
    if (!placeName) return fallback;

    const resolved: GeoLocation = {
      id: `${latitude.toFixed(4)},${longitude.toFixed(4)}`,
      name: placeName,
      country: addr?.country || 'Global',
      admin1: addr?.state,
      latitude,
      longitude,
    };
    reverseCache.set(key, resolved, 60 * 60 * 1000);
    return resolved;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
