import { describe, expect, it } from 'vitest';
import { calculateCompositeAqi, calculateSubIndex } from '../src/utils/aqiCalculator.ts';

describe('US EPA AQI Calculator', () => {
  it('computes Good category for low PM2.5 concentrations', () => {
    const res = calculateCompositeAqi({
      pm25: 6.5,
      pm10: 18,
      no2: 12,
      o3: 40,
      so2: 4,
      co: 300,
    });
    expect(res.aqi).toBeLessThanOrEqual(50);
    expect(res.category).toBe('good');
    expect(res.dominantPollutant).toBe('pm25');
  });

  it('computes Unhealthy category when PM2.5 exceeds 55.5 µg/m³', () => {
    const sub = calculateSubIndex('pm25', 85.0);
    expect(sub).not.toBeNull();
    expect(sub!).toBeGreaterThanOrEqual(151);
    expect(sub!).toBeLessThanOrEqual(200);
  });

  it('identifies ozone as dominant pollutant when PM2.5 is clean and O3 is elevated', () => {
    const res = calculateCompositeAqi({
      pm25: 5.0,
      pm10: 15,
      no2: 10,
      o3: 175,
      so2: 5,
      co: 200,
    });
    expect(res.dominantPollutant).toBe('o3');
    expect(res.aqi).toBeGreaterThanOrEqual(151);
  });
});
