import { getAqiLevel } from '../constants/aqiScale.ts';
import type { AqiCategoryKey, PollutantReadings } from '../types/airQuality.ts';

interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

// US EPA PM2.5 (2024 revised breakpoints, µg/m³)
const PM25_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.5, cHigh: 500.4, iLow: 301, iHigh: 500 },
];

// US EPA PM10 (µg/m³)
const PM10_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
  { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
  { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
  { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
  { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
  { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
];

// US EPA O3 8-hr approx converted from µg/m³ (1 ppb O3 ≈ 1.96 µg/m³)
const O3_UG_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 106, iLow: 0, iHigh: 50 },
  { cLow: 107, cHigh: 137, iLow: 51, iHigh: 100 },
  { cLow: 138, cHigh: 167, iLow: 101, iHigh: 150 },
  { cLow: 168, cHigh: 206, iLow: 151, iHigh: 200 },
  { cLow: 207, cHigh: 392, iLow: 201, iHigh: 300 },
];

// US EPA NO2 1-hr approx converted from µg/m³ (1 ppb NO2 ≈ 1.88 µg/m³)
const NO2_UG_BREAKPOINTS: Breakpoint[] = [
  { cLow: 0, cHigh: 100, iLow: 0, iHigh: 50 },
  { cLow: 101, cHigh: 188, iLow: 51, iHigh: 100 },
  { cLow: 189, cHigh: 677, iLow: 101, iHigh: 150 },
  { cLow: 678, cHigh: 1220, iLow: 151, iHigh: 200 },
  { cLow: 1221, cHigh: 2348, iLow: 201, iHigh: 300 },
];

function interpolateAqi(concentration: number, table: Breakpoint[]): number {
  const c = Math.max(0, concentration);
  for (const bp of table) {
    if (c <= bp.cHigh) {
      return Math.round(
        ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (c - bp.cLow) + bp.iLow,
      );
    }
  }
  return 500;
}

export function calculateSubIndex(
  pollutant: keyof PollutantReadings,
  value: number | null,
): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  switch (pollutant) {
    case 'pm25':
      return interpolateAqi(Math.round(value * 10) / 10, PM25_BREAKPOINTS);
    case 'pm10':
      return interpolateAqi(Math.round(value), PM10_BREAKPOINTS);
    case 'o3':
      return interpolateAqi(Math.round(value), O3_UG_BREAKPOINTS);
    case 'no2':
      return interpolateAqi(Math.round(value), NO2_UG_BREAKPOINTS);
    case 'so2':
      // 1 ppb SO2 ≈ 2.62 µg/m³; 35 ppb ≈ 92 µg/m³
      return Math.min(300, Math.round((value / 92) * 50));
    case 'co':
      // 4.4 ppm ≈ 5040 µg/m³ for AQI 50
      return Math.min(300, Math.round((value / 5040) * 50));
    default:
      return null;
  }
}

export function calculateCompositeAqi(pollutants: PollutantReadings): {
  aqi: number;
  category: AqiCategoryKey;
  dominantPollutant: keyof PollutantReadings;
} {
  const keys: Array<keyof PollutantReadings> = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co'];
  let maxAqi = 0;
  let dominant: keyof PollutantReadings = 'pm25';

  for (const key of keys) {
    const sub = calculateSubIndex(key, pollutants[key]);
    if (sub !== null && sub >= maxAqi) {
      maxAqi = sub;
      dominant = key;
    }
  }

  return {
    aqi: maxAqi,
    category: getAqiLevel(maxAqi).key,
    dominantPollutant: dominant,
  };
}
