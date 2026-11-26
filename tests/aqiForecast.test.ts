import { describe, expect, it } from 'vitest';
import type { HourlyAtmosphericPoint } from '../src/types/airQuality.ts';
import { generateAqiForecast } from '../src/utils/aqiForecast.ts';

function buildSeries(count: number, baseAqi: number, windSpeedKmh: number): HourlyAtmosphericPoint[] {
  const start = Date.now() - count * 3600 * 1000;
  return Array.from({ length: count }).map((_, idx) => ({
    timestamp: new Date(start + idx * 3600 * 1000).toISOString(),
    aqi: baseAqi + Math.sin(idx / 3) * 8,
    pm25: 25,
    pm10: 45,
    no2: 20,
    o3: 40,
    windSpeedKmh,
    humidityPct: 55,
    temperatureC: 24,
  }));
}

describe('Predictive AQI Forecasting Model', () => {
  it('generates 48 historical + 48 future points with bounded confidence intervals', () => {
    const history = buildSeries(48, 95, 10);
    const upstream = buildSeries(48, 90, 12);

    const forecast = generateAqiForecast(history, upstream, 48);
    expect(forecast.points.length).toBe(96);

    const futureOnly = forecast.points.filter((p) => !p.isHistorical);
    expect(futureOnly.length).toBe(48);

    for (const pt of futureOnly) {
      expect(pt.confidenceLow).toBeLessThanOrEqual(pt.predictedAqi);
      expect(pt.confidenceHigh).toBeGreaterThanOrEqual(pt.predictedAqi);
      expect(pt.predictedAqi).toBeGreaterThanOrEqual(5);
      expect(pt.predictedAqi).toBeLessThanOrEqual(500);
    }
  });

  it('notes active wind dispersion when forecast wind speed is high', () => {
    const history = buildSeries(24, 110, 22);
    const upstream = buildSeries(24, 95, 24);
    const forecast = generateAqiForecast(history, upstream, 24);
    expect(forecast.dispersionNote.toLowerCase()).toContain('dispersing');
  });
});
