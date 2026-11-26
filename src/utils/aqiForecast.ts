import type { ForecastPoint, ForecastSummary, HourlyAtmosphericPoint } from '../types/airQuality.ts';

/**
 * Predictive AQI Forecasting Model
 *
 * Combines:
 * 1. Holt's Double Exponential Smoothing (level + trend momentum) over historical AQI.
 * 2. Diurnal urban emission harmonic (morning rush ~08:00, nocturnal inversion ~22:00).
 * 3. Meteorological dispersion weighting from forecast wind speed and relative humidity.
 * 4. Upstream CAMS atmospheric ensemble blending when available.
 */
export function generateAqiForecast(
  historical: HourlyAtmosphericPoint[],
  upstreamForecast: HourlyAtmosphericPoint[],
  horizonHours = 48,
): ForecastSummary {
  if (historical.length === 0) {
    return {
      points: [],
      next24hPeakAqi: 0,
      next24hPeakTime: new Date().toISOString(),
      next24hAvgAqi: 0,
      trendDirection: 'stable',
      modelMae: 0,
      dispersionNote: 'Insufficient historical telemetry for predictive modeling.',
    };
  }

  // Take the most recent 48 hours of history for visualization & model fitting
  const recentHistory = historical.slice(-48);
  const series = recentHistory.map((p) => p.aqi);

  // Holt's linear exponential smoothing parameters
  const alpha = 0.42;
  const beta = 0.18;

  let level = series[0];
  let trend = series.length > 1 ? series[1] - series[0] : 0;
  const inSampleErrors: number[] = [];

  for (let i = 1; i < series.length; i++) {
    const oneStepForecast = Math.max(5, level + trend);
    inSampleErrors.push(Math.abs(series[i] - oneStepForecast));

    const prevLevel = level;
    level = alpha * series[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  // Dampen extreme trends so multi-day predictions stay physically grounded
  const dampedTrend = Math.max(-2.5, Math.min(2.5, trend));
  const mae =
    inSampleErrors.length > 0
      ? Math.round((inSampleErrors.reduce((a, b) => a + b, 0) / inSampleErrors.length) * 10) / 10
      : 4.5;

  const points: ForecastPoint[] = [];

  // Push historical points first
  recentHistory.forEach((pt, idx) => {
    const offset = idx - (recentHistory.length - 1);
    points.push({
      timestamp: pt.timestamp,
      hourOffset: offset,
      observedAqi: Math.round(pt.aqi),
      predictedAqi: Math.round(pt.aqi),
      confidenceLow: Math.round(pt.aqi),
      confidenceHigh: Math.round(pt.aqi),
      windDispersionFactor: computeDispersionFactor(pt.windSpeedKmh, pt.humidityPct),
      isHistorical: true,
    });
  });

  const lastHistTime = new Date(recentHistory[recentHistory.length - 1].timestamp).getTime();
  const baseWind = recentHistory[recentHistory.length - 1].windSpeedKmh;
  const baseHumidity = recentHistory[recentHistory.length - 1].humidityPct;

  const future24Points: ForecastPoint[] = [];

  for (let h = 1; h <= horizonHours; h++) {
    const targetTime = new Date(lastHistTime + h * 3600 * 1000);
    const hourOfDay = targetTime.getUTCHours();

    // Diurnal boundary-layer oscillation (+8% during evening/morning peak, -8% mid-afternoon mixing)
    const diurnalFactor =
      1 + 0.08 * Math.sin(((hourOfDay - 6) / 24) * 2 * Math.PI + Math.PI / 2);

    const upstream = upstreamForecast[h - 1];
    const windKmh = upstream ? upstream.windSpeedKmh : baseWind;
    const humidityPct = upstream ? upstream.humidityPct : baseHumidity;
    const dispersionFactor = computeDispersionFactor(windKmh, humidityPct);

    // Damped Holt projection
    const phi = Math.pow(0.92, h);
    const holtProjection = Math.max(8, (level + h * dampedTrend * phi) * diurnalFactor * dispersionFactor);

    // Blend Holt+Meteorological model (55%) with Copernicus upstream ensemble (45%) if available
    const predictedRaw = upstream
      ? 0.55 * holtProjection + 0.45 * upstream.aqi
      : holtProjection;

    const predictedAqi = Math.max(5, Math.min(500, Math.round(predictedRaw)));
    const uncertaintySpread = Math.round(Math.max(4, mae * 0.85 * Math.sqrt(h)));

    const point: ForecastPoint = {
      timestamp: targetTime.toISOString(),
      hourOffset: h,
      observedAqi: null,
      predictedAqi,
      confidenceLow: Math.max(3, predictedAqi - uncertaintySpread),
      confidenceHigh: Math.min(500, predictedAqi + uncertaintySpread),
      windDispersionFactor: Math.round(dispersionFactor * 100) / 100,
      isHistorical: false,
    };

    points.push(point);
    if (h <= 24) {
      future24Points.push(point);
    }
  }

  let peakPoint = future24Points[0];
  let sum24 = 0;
  for (const pt of future24Points) {
    sum24 += pt.predictedAqi;
    if (pt.predictedAqi > peakPoint.predictedAqi) {
      peakPoint = pt;
    }
  }

  const currentAqi = series[series.length - 1];
  const avg24 = Math.round(sum24 / Math.max(1, future24Points.length));
  const delta = avg24 - currentAqi;

  let trendDirection: 'improving' | 'stable' | 'worsening' = 'stable';
  if (delta <= -6) trendDirection = 'improving';
  else if (delta >= 6) trendDirection = 'worsening';

  const avgWind =
    upstreamForecast.length > 0
      ? upstreamForecast.slice(0, 24).reduce((s, p) => s + p.windSpeedKmh, 0) /
        Math.min(24, upstreamForecast.length)
      : baseWind;

  let dispersionNote = 'Moderate boundary-layer mixing keeps concentrations near baseline.';
  if (avgWind >= 18) {
    dispersionNote = `Stronger winds (~${Math.round(avgWind)} km/h) are actively dispersing urban particulates.`;
  } else if (avgWind <= 7) {
    dispersionNote = `Stagnant winds (~${Math.round(avgWind)} km/h) increase overnight pollutant trapping risk.`;
  }

  return {
    points,
    next24hPeakAqi: peakPoint?.predictedAqi ?? currentAqi,
    next24hPeakTime: peakPoint?.timestamp ?? new Date().toISOString(),
    next24hAvgAqi: avg24,
    trendDirection,
    modelMae: mae,
    dispersionNote,
  };
}

function computeDispersionFactor(windSpeedKmh: number, humidityPct: number): number {
  // Higher wind speed disperses PM2.5; higher humidity (>75%) slightly increases hygroscopic aerosol growth
  const windModifier = windSpeedKmh >= 20 ? 0.86 : windSpeedKmh <= 6 ? 1.12 : 1 - (windSpeedKmh - 12) * 0.012;
  const humidityModifier = humidityPct > 75 ? 1 + (humidityPct - 75) * 0.003 : 1;
  return Math.max(0.75, Math.min(1.25, windModifier * humidityModifier));
}
