import type { AqiCategoryKey, PollutantReadings } from '../types/airQuality.ts';

export interface AqiLevelDefinition {
  key: AqiCategoryKey;
  label: string;
  shortLabel: string;
  min: number;
  max: number;
  hex: string;
  textClass: string;
  bgSubtleClass: string;
  borderClass: string;
  symbol: string;
  summary: string;
}

/**
 * Explicit WCAG 2.1 AA accessible EPA AQI scale.
 * Every category pairs color with an explicit text label and geometric symbol
 * so critical state is never communicated by hue alone.
 */
export const AQI_LEVELS: AqiLevelDefinition[] = [
  {
    key: 'good',
    label: 'Good',
    shortLabel: 'Good',
    min: 0,
    max: 50,
    hex: '#10B981',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    bgSubtleClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    symbol: '●',
    summary: 'Air quality is satisfactory with minimal or no respiratory risk.',
  },
  {
    key: 'moderate',
    label: 'Moderate',
    shortLabel: 'Moderate',
    min: 51,
    max: 100,
    hex: '#F59E0B',
    textClass: 'text-amber-700 dark:text-amber-300',
    bgSubtleClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    symbol: '◆',
    summary: 'Acceptable air quality; sensitive individuals may experience mild symptoms.',
  },
  {
    key: 'sensitive',
    label: 'Unhealthy for Sensitive Groups',
    shortLabel: 'Sensitive',
    min: 101,
    max: 150,
    hex: '#F97316',
    textClass: 'text-orange-700 dark:text-orange-300',
    bgSubtleClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/30',
    symbol: '▲',
    summary: 'Children, seniors, and people with respiratory or heart disease face elevated risk.',
  },
  {
    key: 'unhealthy',
    label: 'Unhealthy',
    shortLabel: 'Unhealthy',
    min: 151,
    max: 200,
    hex: '#EF4444',
    textClass: 'text-rose-700 dark:text-rose-400',
    bgSubtleClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30',
    symbol: '■',
    summary: 'Everyone may begin to experience respiratory irritation; limit prolonged outdoor effort.',
  },
  {
    key: 'very_unhealthy',
    label: 'Very Unhealthy',
    shortLabel: 'Very Unhealthy',
    min: 201,
    max: 300,
    hex: '#C084FC',
    textClass: 'text-purple-700 dark:text-purple-300',
    bgSubtleClass: 'bg-purple-500/15',
    borderClass: 'border-purple-500/35',
    symbol: '✖',
    summary: 'Health alert: increased likelihood of acute cardiopulmonary symptoms across all groups.',
  },
  {
    key: 'hazardous',
    label: 'Hazardous',
    shortLabel: 'Hazardous',
    min: 301,
    max: 500,
    hex: '#FB7185',
    textClass: 'text-red-700 dark:text-red-300',
    bgSubtleClass: 'bg-red-500/20',
    borderClass: 'border-red-500/40',
    symbol: '✖✖',
    summary: 'Emergency atmospheric condition. Avoid all outdoor physical exertion and seal indoor air.',
  },
];

export function getAqiLevel(aqi: number): AqiLevelDefinition {
  const clamped = Math.max(0, Math.round(aqi));
  return (
    AQI_LEVELS.find((lvl) => clamped >= lvl.min && clamped <= lvl.max) ??
    AQI_LEVELS[AQI_LEVELS.length - 1]
  );
}

export interface PollutantMetadata {
  key: keyof PollutantReadings;
  name: string;
  formula: string;
  unit: string;
  who24hGuideline: number;
  description: string;
}

export const POLLUTANT_META: PollutantMetadata[] = [
  {
    key: 'pm25',
    name: 'Fine Particulates',
    formula: 'PM₂.₅',
    unit: 'µg/m³',
    who24hGuideline: 15,
    description: 'Ultrafine particles (<2.5 µm) capable of entering deep alveoli and bloodstream.',
  },
  {
    key: 'pm10',
    name: 'Coarse Particulates',
    formula: 'PM₁₀',
    unit: 'µg/m³',
    who24hGuideline: 45,
    description: 'Inhalable dust, pollen, and road resuspension particles (<10 µm).',
  },
  {
    key: 'no2',
    name: 'Nitrogen Dioxide',
    formula: 'NO₂',
    unit: 'µg/m³',
    who24hGuideline: 25,
    description: 'Combustion gas from vehicular traffic and fossil power generation.',
  },
  {
    key: 'o3',
    name: 'Ground Ozone',
    formula: 'O₃',
    unit: 'µg/m³',
    who24hGuideline: 100,
    description: 'Photochemical oxidant formed when sunlight reacts with urban emissions.',
  },
  {
    key: 'so2',
    name: 'Sulfur Dioxide',
    formula: 'SO₂',
    unit: 'µg/m³',
    who24hGuideline: 40,
    description: 'Industrial sulfur gas linked to coal/oil refining and maritime exhaust.',
  },
  {
    key: 'co',
    name: 'Carbon Monoxide',
    formula: 'CO',
    unit: 'µg/m³',
    who24hGuideline: 4000,
    description: 'Colorless gas produced by incomplete fuel combustion.',
  },
];
