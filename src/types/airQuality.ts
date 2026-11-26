export type AqiCategoryKey =
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous';

export interface GeoLocation {
  id: string;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface PollutantReadings {
  pm25: number | null; // µg/m³
  pm10: number | null; // µg/m³
  no2: number | null;  // µg/m³
  o3: number | null;   // µg/m³
  so2: number | null;  // µg/m³
  co: number | null;   // µg/m³
}

export interface WeatherTelemetry {
  temperatureC: number;
  apparentTemperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windGustsKmh: number;
  surfacePressureHpa: number;
  uvIndex: number;
  cloudCoverPct: number;
  visibilityKm: number | null;
  conditionLabel: string;
  source: 'openweather' | 'open-meteo';
  updatedAt: string;
}

export interface HourlyAtmosphericPoint {
  timestamp: string;
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  windSpeedKmh: number;
  humidityPct: number;
  temperatureC: number;
}

export interface AirQualitySnapshot {
  location: GeoLocation;
  aqi: number;
  category: AqiCategoryKey;
  dominantPollutant: keyof PollutantReadings;
  pollutants: PollutantReadings;
  stationName: string;
  stationDistanceKm: number | null;
  source: 'openaq+open-meteo' | 'openaq' | 'open-meteo';
  weather: WeatherTelemetry;
  hourlyHistory: HourlyAtmosphericPoint[];
  upstreamHourlyForecast: HourlyAtmosphericPoint[];
  updatedAt: string;
  fromCache?: boolean;
}

export interface GlobalHubPin {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  aqi: number;
  pm25: number | null;
  windSpeedKmh: number;
  temperatureC: number;
  category: AqiCategoryKey;
  source: string;
  updatedAt: string;
}

export interface ForecastPoint {
  timestamp: string;
  hourOffset: number;
  observedAqi: number | null;
  predictedAqi: number;
  confidenceLow: number;
  confidenceHigh: number;
  windDispersionFactor: number;
  isHistorical: boolean;
}

export interface ForecastSummary {
  points: ForecastPoint[];
  next24hPeakAqi: number;
  next24hPeakTime: string;
  next24hAvgAqi: number;
  trendDirection: 'improving' | 'stable' | 'worsening';
  modelMae: number;
  dispersionNote: string;
}

export interface VulnerableGroupAdvice {
  id: string;
  groupName: string;
  riskLevel: 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Severe';
  guidance: string;
  actionItem: string;
}

export interface ClimateNewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  category: 'Air Quality' | 'Climate Policy' | 'Clean Energy' | 'Atmospheric Science';
  imageUrl: string;
}

export type IncidentCategory =
  | 'Industrial Smoke'
  | 'Waste Burning'
  | 'Vehicular Emissions'
  | 'Construction Dust'
  | 'Chemical Odor';

export type IncidentSeverity = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface CommunityReport {
  id: string;
  title: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  description: string;
  locationName: string;
  latitude: number;
  longitude: number;
  photoDataUrl: string | null;
  reporterName: string;
  upvotes: number;
  createdAt: string;
  pendingSync?: boolean;
}

export interface CarbonFootprintInputs {
  carKmPerWeek: number;
  vehicleType: 'petrol' | 'diesel' | 'hybrid' | 'ev' | 'none';
  publicTransitKmPerWeek: number;
  shortFlightsPerYear: number;
  longFlightsPerYear: number;
  electricityKwhPerMonth: number;
  renewableSharePct: number;
  dietType: 'meat_heavy' | 'balanced' | 'vegetarian' | 'vegan';
  recyclingRatePct: number;
}

export interface CarbonFootprintResult {
  totalTonnesCo2e: number;
  sustainabilityScore: number; // 0-100
  gradeLabel: 'Exemplary' | 'Low Impact' | 'Moderate' | 'High' | 'Very High';
  breakdown: {
    transport: number;
    flights: number;
    homeEnergy: number;
    diet: number;
    waste: number;
  };
  vsParisTargetDelta: number; // relative to 2.0 t/yr
  topActions: Array<{
    title: string;
    estimatedReductionTonnes: number;
    effort: 'Easy' | 'Moderate' | 'Major';
  }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}
