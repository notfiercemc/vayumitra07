import { getAqiLevel } from '../../src/constants/aqiScale.ts';
import type {
  AirQualitySnapshot,
  GeoLocation,
  GlobalHubPin,
  HourlyAtmosphericPoint,
  PollutantReadings,
} from '../../src/types/airQuality.ts';
import { calculateCompositeAqi } from '../../src/utils/aqiCalculator.ts';
import { MemoryCache, quotaTracker } from '../middleware/rateLimiter.ts';
import { fetchWeatherTelemetry } from './weatherService.ts';

const snapshotCache = new MemoryCache<AirQualitySnapshot>();
const globalPinsCache = new MemoryCache<GlobalHubPin[]>();

const GLOBAL_MONITORING_HUBS: Array<{
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}> = [
  { id: 'hub-delhi', name: 'New Delhi', country: 'India', latitude: 28.6139, longitude: 77.209 },
  { id: 'hub-mumbai', name: 'Mumbai', country: 'India', latitude: 19.076, longitude: 72.8777 },
  { id: 'hub-beijing', name: 'Beijing', country: 'China', latitude: 39.9042, longitude: 116.4074 },
  { id: 'hub-tokyo', name: 'Tokyo', country: 'Japan', latitude: 35.6762, longitude: 139.6503 },
  { id: 'hub-london', name: 'London', country: 'United Kingdom', latitude: 51.5072, longitude: -0.1276 },
  { id: 'hub-paris', name: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522 },
  { id: 'hub-nyc', name: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.006 },
  { id: 'hub-la', name: 'Los Angeles', country: 'United States', latitude: 34.0522, longitude: -118.2437 },
  { id: 'hub-saopaulo', name: 'São Paulo', country: 'Brazil', latitude: -23.5505, longitude: -46.6333 },
  { id: 'hub-cairo', name: 'Cairo', country: 'Egypt', latitude: 30.0444, longitude: 31.2357 },
  { id: 'hub-nairobi', name: 'Nairobi', country: 'Kenya', latitude: -1.2921, longitude: 36.8219 },
  { id: 'hub-jakarta', name: 'Jakarta', country: 'Indonesia', latitude: -6.2088, longitude: 106.8456 },
  { id: 'hub-sydney', name: 'Sydney', country: 'Australia', latitude: -33.8688, longitude: 151.2093 },
  { id: 'hub-mexico', name: 'Mexico City', country: 'Mexico', latitude: 19.4326, longitude: -99.1332 },
];

interface OpenAqLocationResult {
  id: number;
  name?: string;
  distance?: number;
  sensors?: Array<{
    id: number;
    parameter?: { name?: string };
  }>;
}

interface OpenAqLatestResult {
  sensorsId: number;
  value: number;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

async function tryFetchOpenAqStation(
  latitude: number,
  longitude: number,
): Promise<{
  stationName: string;
  distanceKm: number | null;
  pollutants: Partial<PollutantReadings>;
} | null> {
  const apiKey = process.env.OPENAQ_API_KEY?.trim();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'VayuMitra-AirQualityAssistant/1.0',
  };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    quotaTracker.recordUpstream('openaq');
    const locUrl = `https://api.openaq.org/v3/locations?coordinates=${latitude.toFixed(4)},${longitude.toFixed(4)}&radius=25000&limit=3`;
    const locRes = await fetch(locUrl, { headers, signal: controller.signal });
    if (!locRes.ok) return null;

    const locJson = (await locRes.json()) as { results?: OpenAqLocationResult[] };
    const station = locJson.results?.[0];
    if (!station) return null;

    const latestUrl = `https://api.openaq.org/v3/locations/${station.id}/latest`;
    const latestRes = await fetch(latestUrl, { headers, signal: controller.signal });
    if (!latestRes.ok) return null;

    const latestJson = (await latestRes.json()) as { results?: OpenAqLatestResult[] };
    const readings = latestJson.results ?? [];
    if (readings.length === 0) return null;

    const sensorMap = new Map<number, string>();
    for (const s of station.sensors ?? []) {
      if (s.parameter?.name) {
        sensorMap.set(s.id, s.parameter.name.toLowerCase());
      }
    }

    const pollutants: Partial<PollutantReadings> = {};
    for (const r of readings) {
      if (typeof r.value !== 'number' || r.value < 0) continue;
      const param = sensorMap.get(r.sensorsId);
      if (!param) continue;
      if (param === 'pm25') pollutants.pm25 = Math.round(r.value * 10) / 10;
      else if (param === 'pm10') pollutants.pm10 = Math.round(r.value * 10) / 10;
      else if (param === 'no2') pollutants.no2 = Math.round(r.value * 10) / 10;
      else if (param === 'o3') pollutants.o3 = Math.round(r.value * 10) / 10;
      else if (param === 'so2') pollutants.so2 = Math.round(r.value * 10) / 10;
      else if (param === 'co') pollutants.co = Math.round(r.value * 10) / 10;
    }

    if (Object.keys(pollutants).length === 0) return null;

    return {
      stationName: station.name || 'OpenAQ Ground Station',
      distanceKm:
        typeof station.distance === 'number'
          ? Math.round((station.distance / 1000) * 10) / 10
          : null,
      pollutants,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

interface OpenMeteoAirResponse {
  current?: {
    time?: string;
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    nitrogen_dioxide?: number;
    ozone?: number;
    sulphur_dioxide?: number;
    carbon_monoxide?: number;
  };
  hourly?: {
    time?: string[];
    us_aqi?: Array<number | null>;
    pm2_5?: Array<number | null>;
    pm10?: Array<number | null>;
    nitrogen_dioxide?: Array<number | null>;
    ozone?: Array<number | null>;
  };
}

export async function fetchAirQualitySnapshot(
  location: GeoLocation,
): Promise<AirQualitySnapshot> {
  const cacheKey = `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
  const cached = snapshotCache.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      location,
      fromCache: true,
    };
  }

  const [openAqData, weatherBundle, openMeteoAir] = await Promise.all([
    tryFetchOpenAqStation(location.latitude, location.longitude),
    fetchWeatherTelemetry(location.latitude, location.longitude),
    fetchOpenMeteoAir(location.latitude, location.longitude),
  ]);

  const currentOm = openMeteoAir.current ?? {};
  const basePollutants: PollutantReadings = {
    pm25: openAqData?.pollutants.pm25 ?? roundNullable(currentOm.pm2_5),
    pm10: openAqData?.pollutants.pm10 ?? roundNullable(currentOm.pm10),
    no2: openAqData?.pollutants.no2 ?? roundNullable(currentOm.nitrogen_dioxide),
    o3: openAqData?.pollutants.o3 ?? roundNullable(currentOm.ozone),
    so2: openAqData?.pollutants.so2 ?? roundNullable(currentOm.sulphur_dioxide),
    co: openAqData?.pollutants.co ?? roundNullable(currentOm.carbon_monoxide),
  };

  const composite = calculateCompositeAqi(basePollutants);
  const effectiveAqi =
    openAqData?.pollutants.pm25 !== undefined
      ? composite.aqi
      : Math.max(composite.aqi, Math.round(currentOm.us_aqi ?? composite.aqi));

  const category = getAqiLevel(effectiveAqi).key;

  const nowMs = Date.now();
  const times = openMeteoAir.hourly?.time ?? [];
  const hourlyHistory: HourlyAtmosphericPoint[] = [];
  const upstreamHourlyForecast: HourlyAtmosphericPoint[] = [];

  for (let i = 0; i < times.length; i++) {
    const tStr = times[i];
    const tMs = new Date(tStr).getTime();
    const wx = weatherBundle.hourlyMap.get(tStr);
    const pt: HourlyAtmosphericPoint = {
      timestamp: new Date(tMs).toISOString(),
      aqi: Math.round(openMeteoAir.hourly?.us_aqi?.[i] ?? effectiveAqi),
      pm25: Math.round((openMeteoAir.hourly?.pm2_5?.[i] ?? basePollutants.pm25 ?? 12) * 10) / 10,
      pm10: Math.round((openMeteoAir.hourly?.pm10?.[i] ?? basePollutants.pm10 ?? 22) * 10) / 10,
      no2: Math.round((openMeteoAir.hourly?.nitrogen_dioxide?.[i] ?? basePollutants.no2 ?? 18) * 10) / 10,
      o3: Math.round((openMeteoAir.hourly?.ozone?.[i] ?? basePollutants.o3 ?? 45) * 10) / 10,
      windSpeedKmh: wx?.windSpeedKmh ?? weatherBundle.current.windSpeedKmh,
      humidityPct: wx?.humidityPct ?? weatherBundle.current.humidityPct,
      temperatureC: wx?.temperatureC ?? weatherBundle.current.temperatureC,
    };

    if (tMs <= nowMs) {
      hourlyHistory.push(pt);
    } else {
      upstreamHourlyForecast.push(pt);
    }
  }

  const snapshot: AirQualitySnapshot = {
    location,
    aqi: effectiveAqi,
    category,
    dominantPollutant: composite.dominantPollutant,
    pollutants: basePollutants,
    stationName: openAqData?.stationName ?? `${location.name} Atmospheric Grid`,
    stationDistanceKm:
      openAqData?.distanceKm ?? haversineKm(location.latitude, location.longitude, location.latitude, location.longitude),
    source: openAqData ? 'openaq+open-meteo' : 'open-meteo',
    weather: weatherBundle.current,
    hourlyHistory,
    upstreamHourlyForecast,
    updatedAt: new Date().toISOString(),
    fromCache: false,
  };

  snapshotCache.set(cacheKey, snapshot, 5 * 60 * 1000);
  return snapshot;
}

async function fetchOpenMeteoAir(
  latitude: number,
  longitude: number,
): Promise<OpenMeteoAirResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    quotaTracker.recordUpstream('openMeteo');
    const url =
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
      `&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide` +
      `&hourly=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&past_days=3&forecast_days=2&timezone=GMT`;

    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Open-Meteo Air Quality error: HTTP ${res.status}`);
    }
    return (await res.json()) as OpenMeteoAirResponse;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchGlobalHubPins(): Promise<GlobalHubPin[]> {
  const cached = globalPinsCache.get('global-hubs');
  if (cached) return cached;

  const lats = GLOBAL_MONITORING_HUBS.map((h) => h.latitude.toFixed(4)).join(',');
  const lons = GLOBAL_MONITORING_HUBS.map((h) => h.longitude.toFixed(4)).join(',');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    quotaTracker.recordUpstream('openMeteo');
    const [airRes, wxRes] = await Promise.all([
      fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi,pm2_5`,
        { signal: controller.signal },
      ),
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,wind_speed_10m`,
        { signal: controller.signal },
      ),
    ]);

    if (!airRes.ok || !wxRes.ok) {
      throw new Error('Failed to retrieve global monitoring hub telemetry');
    }

    const airData = (await airRes.json()) as Array<{
      current?: { us_aqi?: number; pm2_5?: number };
    }>;
    const wxData = (await wxRes.json()) as Array<{
      current?: { temperature_2m?: number; wind_speed_10m?: number };
    }>;

    const nowIso = new Date().toISOString();
    const pins: GlobalHubPin[] = GLOBAL_MONITORING_HUBS.map((hub, idx) => {
      const airCur = airData[idx]?.current ?? {};
      const wxCur = wxData[idx]?.current ?? {};
      const aqi = Math.max(1, Math.round(airCur.us_aqi ?? 35));
      return {
        id: hub.id,
        name: hub.name,
        country: hub.country,
        latitude: hub.latitude,
        longitude: hub.longitude,
        aqi,
        pm25: roundNullable(airCur.pm2_5),
        windSpeedKmh: Math.round((wxCur.wind_speed_10m ?? 10) * 10) / 10,
        temperatureC: Math.round((wxCur.temperature_2m ?? 20) * 10) / 10,
        category: getAqiLevel(aqi).key,
        source: 'Open-Meteo CAMS / Global Grid',
        updatedAt: nowIso,
      };
    });

    globalPinsCache.set('global-hubs', pins, 10 * 60 * 1000);
    return pins;
  } finally {
    clearTimeout(timeout);
  }
}

function roundNullable(val: number | undefined | null): number | null {
  if (typeof val !== 'number' || !Number.isFinite(val)) return null;
  return Math.round(val * 10) / 10;
}
