import type { WeatherTelemetry } from '../../src/types/airQuality.ts';
import { quotaTracker } from '../middleware/rateLimiter.ts';

interface OpenMeteoWeatherResponse {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wind_gusts_10m?: number;
    surface_pressure?: number;
    cloud_cover?: number;
    weather_code?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
    wind_speed_10m?: number[];
    uv_index?: number[];
    visibility?: number[];
  };
}

function weatherCodeToLabel(code: number | undefined): string {
  if (code === undefined) return 'Clear';
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Haze / Fog';
  if (code >= 51 && code <= 67) return 'Rain / Drizzle';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Overcast';
}

export async function fetchWeatherTelemetry(
  latitude: number,
  longitude: number,
): Promise<{
  current: WeatherTelemetry;
  hourlyMap: Map<string, { windSpeedKmh: number; humidityPct: number; temperatureC: number }>;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    quotaTracker.recordUpstream('openMeteo');
    const omUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,cloud_cover,weather_code` +
      `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,uv_index,visibility&past_days=3&forecast_days=2&timezone=GMT`;

    const res = await fetch(omUrl, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Open-Meteo Weather error: HTTP ${res.status}`);
    }
    const om = (await res.json()) as OpenMeteoWeatherResponse;

    const hourlyMap = new Map<
      string,
      { windSpeedKmh: number; humidityPct: number; temperatureC: number }
    >();
    const times = om.hourly?.time ?? [];
    for (let i = 0; i < times.length; i++) {
      hourlyMap.set(times[i], {
        windSpeedKmh: om.hourly?.wind_speed_10m?.[i] ?? 10,
        humidityPct: om.hourly?.relative_humidity_2m?.[i] ?? 50,
        temperatureC: om.hourly?.temperature_2m?.[i] ?? 20,
      });
    }

    const cur = om.current ?? {};
    const currentIsoHour = new Date().toISOString().slice(0, 13) + ':00';
    const hourIdx = times.indexOf(currentIsoHour);
    const uvIndex =
      hourIdx >= 0 && om.hourly?.uv_index?.[hourIdx] !== undefined
        ? Math.round(om.hourly.uv_index[hourIdx] * 10) / 10
        : 2.0;
    const visibilityMeters =
      hourIdx >= 0 ? om.hourly?.visibility?.[hourIdx] : undefined;

    let current: WeatherTelemetry = {
      temperatureC: Math.round((cur.temperature_2m ?? 20) * 10) / 10,
      apparentTemperatureC: Math.round((cur.apparent_temperature ?? cur.temperature_2m ?? 20) * 10) / 10,
      humidityPct: Math.round(cur.relative_humidity_2m ?? 50),
      windSpeedKmh: Math.round((cur.wind_speed_10m ?? 10) * 10) / 10,
      windDirectionDeg: Math.round(cur.wind_direction_10m ?? 0),
      windGustsKmh: Math.round((cur.wind_gusts_10m ?? cur.wind_speed_10m ?? 12) * 10) / 10,
      surfacePressureHpa: Math.round(cur.surface_pressure ?? 1013),
      uvIndex,
      cloudCoverPct: Math.round(cur.cloud_cover ?? 20),
      visibilityKm:
        typeof visibilityMeters === 'number'
          ? Math.round((visibilityMeters / 1000) * 10) / 10
          : null,
      conditionLabel: weatherCodeToLabel(cur.weather_code),
      source: 'open-meteo',
      updatedAt: new Date().toISOString(),
    };

    // Optional OpenWeatherMap enrichment if user configures OPENWEATHER_API_KEY
    const owKey = process.env.OPENWEATHER_API_KEY?.trim();
    if (owKey) {
      try {
        quotaTracker.recordUpstream('openWeather');
        const owRes = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${encodeURIComponent(owKey)}`,
          { signal: controller.signal },
        );
        if (owRes.ok) {
          const ow = (await owRes.json()) as {
            main?: { temp?: number; feels_like?: number; humidity?: number; pressure?: number };
            wind?: { speed?: number; deg?: number };
            visibility?: number;
            weather?: Array<{ description?: string }>;
          };
          current = {
            ...current,
            temperatureC: ow.main?.temp !== undefined ? Math.round(ow.main.temp * 10) / 10 : current.temperatureC,
            apparentTemperatureC:
              ow.main?.feels_like !== undefined ? Math.round(ow.main.feels_like * 10) / 10 : current.apparentTemperatureC,
            humidityPct: ow.main?.humidity ?? current.humidityPct,
            surfacePressureHpa: ow.main?.pressure ?? current.surfacePressureHpa,
            windSpeedKmh:
              ow.wind?.speed !== undefined ? Math.round(ow.wind.speed * 3.6 * 10) / 10 : current.windSpeedKmh,
            windDirectionDeg: ow.wind?.deg ?? current.windDirectionDeg,
            visibilityKm:
              typeof ow.visibility === 'number'
                ? Math.round((ow.visibility / 1000) * 10) / 10
                : current.visibilityKm,
            conditionLabel: ow.weather?.[0]?.description
              ? ow.weather[0].description.replace(/\b\w/g, (c) => c.toUpperCase())
              : current.conditionLabel,
            source: 'openweather',
          };
        }
      } catch {
        // Keep Open-Meteo weather telemetry on OpenWeather timeout
      }
    }

    return { current, hourlyMap };
  } finally {
    clearTimeout(timeout);
  }
}
