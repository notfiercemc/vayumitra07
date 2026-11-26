# VayuMitra — Urban Air Quality Assistant Architecture

## 1. System Overview

VayuMitra is a full-stack environmental intelligence platform designed with a dark-first telemetry UI, WCAG 2.1 AA accessibility, offline resilience, and real-time multi-source atmospheric data fusion.

### Key Architectural Pillars
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Leaflet interactive mapping, and custom SVG dual-axis predictive charting.
- **Backend Proxy (`server.ts`)**: Express 4 server acting as a secure API gateway, rate limiter, cache layer, community report store, and `@google/genai` proxy.
- **Data Fusion & Graceful Degradation**:
  - **Ground Sensors & Global Air Quality**: Queries **OpenAQ v3** (`OPENAQ_API_KEY` when configured) and fuses/falls back seamlessly to **Open-Meteo Air Quality (Copernicus CAMS)** so every coordinate worldwide resolves live PM2.5, PM10, NO₂, O₃, SO₂, CO, and 72h historical series.
  - **Meteorology**: Queries **OpenWeatherMap** (if `OPENWEATHER_API_KEY` is provided) or **Open-Meteo Forecast API** for temperature, humidity, wind velocity/gusts, surface pressure, and UV index.
  - **Global Geocoding**: Open-Meteo Geocoding API supporting any city, region, or coordinate pair globally.
  - **Climate Journalism**: Live news aggregator querying **GDELT 2.0 Doc API** / **The Guardian Open Platform / RSS feeds** with domain allowlisting, 15-minute server caching, and curated fallback articles if upstream networks are throttled.
  - **AI Environmental Assistant**: Server-side `@google/genai` (`gemini-4-hydrogen`) grounded in live atmospheric telemetry and user carbon metrics.

---

## 2. Folder Hierarchy

```text
├── server.ts                          # Express entry point + Vite dev middleware / static prod serving
├── server/
│   ├── middleware/
│   │   └── rateLimiter.ts             # Sliding-window IP rate limiter & upstream quota tracker
│   ├── services/
│   │   ├── airQualityService.ts       # OpenAQ v3 + Open-Meteo AQI fusion & US EPA AQI calculator
│   │   ├── weatherService.ts          # Open-Meteo / OpenWeather atmospheric telemetry
│   │   ├── geocodingService.ts        # Global location search
│   │   ├── newsService.ts             # Live climate news fetch + cache
│   │   ├── reportsStore.ts            # Validated community pollution reports + photo handling
│   │   └── geminiService.ts           # Server-side Gemini environmental assistant
│   └── data/
│       └── reports.json               # Persisted community incident reports
├── src/
│   ├── constants/
│   │   └── aqiScale.ts                # WCAG AA accessible EPA AQI scale & pollutant thresholds
│   ├── types/
│   │   └── airQuality.ts              # Shared domain TypeScript interfaces
│   ├── utils/
│   │   ├── aqiCalculator.ts           # US EPA breakpoint interpolation
│   │   ├── aqiForecast.ts             # Holt-Winters + meteorological dispersion forecasting engine
│   │   └── carbonCalculator.ts        # Annual CO2e & sustainability score model
│   ├── services/
│   │   ├── apiClient.ts               # Resilient HTTP client with timeouts & error normalization
│   │   └── offlineCache.ts            # LocalStorage snapshot cache & offline report queue
│   └── components/
│       ├── layout/TopNav.tsx
│       ├── map/GlobalAqiMap.tsx
│       ├── dashboard/
│       ├── forecast/
│       ├── health/
│       ├── community/
│       ├── climate/
│       ├── chat/
│       └── common/
├── tests/                             # Vitest automated test suite
├── netlify.toml                       # Netlify build & routing pipeline
└── .env.example                       # Environment variable template
```

---

## 3. API Quota & Traffic Protection

To protect upstream API quotas during competition traffic spikes:
1. **Per-Endpoint Response Caching**:
   - Air quality & weather snapshots: **5-minute** in-memory TTL keyed by rounded coordinates (`0.05°` grid).
   - Global hub overview pins: **10-minute** shared TTL.
   - Climate news feed: **15-minute** shared TTL.
2. **Sliding-Window Rate Limiter**:
   - Protects `/api/chat` (20 req/min/IP) and `/api/reports` (10 req/min/IP), plus general `/api/*` (120 req/min/IP), returning standard `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` headers.
3. **Client Offline Caching (`offlineCache.ts`)**:
   - Stores last-known atmospheric snapshots, forecasts, and news locally so intermittent connections or offline mode continue rendering full telemetry with a clear timestamp notice.

---

## 4. Predictive AQI Forecasting Model

Located in `src/utils/aqiForecast.ts`, the forecasting model combines:
- **72-Hour Historical Series**: Extracts hourly PM2.5 and US AQI trajectories.
- **Double Exponential Smoothing (Holt's Linear Trend)**: Captures short-term pollutant momentum ($\alpha = 0.42$, $\beta = 0.18$).
- **Diurnal Boundary-Layer Harmonic**: Models morning/evening traffic peaks and nocturnal inversion layers.
- **Meteorological Dispersion Factor**: Modulates predicted concentrations using forecast wind speed (ventilation dispersion) and relative humidity (hygroscopic particulate growth).
- **Confidence Bounds**: Outputs 95% uncertainty bands widening smoothly over the 48-hour horizon alongside MAE diagnostics.

---

## 5. Deployment Pipeline

### Node / Cloud Run / Container
```bash
npm install
npm run test
npm run build
NODE_ENV=production npm start
```

### Netlify
1. Connect repository to Netlify (`netlify.toml` auto-detected).
2. Configure environment variables (`GEMINI_API_KEY`, `OPENAQ_API_KEY`, `OPENWEATHER_API_KEY`) in Netlify Site Settings.
3. Build command `npm run build` outputs the static bundle to `dist/`, with `/api/*` routing configured in `netlify.toml` for serverless proxy deployment.
