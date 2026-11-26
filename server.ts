import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createRateLimiter, quotaTracker } from './server/middleware/rateLimiter.ts';
import {
  fetchAirQualitySnapshot,
  fetchGlobalHubPins,
} from './server/services/airQualityService.ts';
import {
  reverseGeocodeLocation,
  searchGlobalLocations,
} from './server/services/geocodingService.ts';
import { generateEnvironmentalReply } from './server/services/geminiService.ts';
import { fetchClimateNews } from './server/services/newsService.ts';
import {
  createCommunityReport,
  listCommunityReports,
  upvoteCommunityReport,
} from './server/services/reportsStore.ts';
import type { GeoLocation } from './src/types/airQuality.ts';

export function createApp() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '2.5mb' }));

  const generalApiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 120,
    keyPrefix: 'api-general',
  });
  const chatLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'api-chat',
  });
  const reportWriteLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 12,
    keyPrefix: 'api-reports',
  });

  app.use('/api', (req, res, next) => {
    quotaTracker.recordRequest();
    generalApiLimiter(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      quota: quotaTracker.getSnapshot(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/geocode', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const results = await searchGlobalLocations(q);
      res.json({ results });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Location search failed.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/reverse-geocode', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
      res.status(400).json({ error: 'Valid latitude and longitude are required.' });
      return;
    }
    const location = await reverseGeocodeLocation(lat, lon);
    res.json({ location });
  });

  app.get('/api/global-hubs', async (_req, res) => {
    try {
      const hubs = await fetchGlobalHubPins();
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json({ hubs });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch global AQI hubs.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/air-quality', async (req, res) => {
    try {
      const lat = Number(req.query.lat ?? 28.6139);
      const lon = Number(req.query.lon ?? 77.209);
      const name = typeof req.query.name === 'string' && req.query.name.trim() ? req.query.name.trim() : 'Selected Location';
      const country = typeof req.query.country === 'string' && req.query.country.trim() ? req.query.country.trim() : 'Global';

      if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        res.status(400).json({ error: 'Valid latitude (-90..90) and longitude (-180..180) are required.' });
        return;
      }

      const location: GeoLocation = {
        id: `${lat.toFixed(4)},${lon.toFixed(4)}`,
        name: name.slice(0, 100),
        country: country.slice(0, 80),
        latitude: lat,
        longitude: lon,
      };

      const snapshot = await fetchAirQualitySnapshot(location);
      res.setHeader('Cache-Control', 'public, max-age=180');
      res.json(snapshot);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Air quality telemetry unavailable.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/news', async (_req, res) => {
    try {
      const articles = await fetchClimateNews();
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.json({ articles });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Climate news feed unavailable.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/reports', (_req, res) => {
    const reports = listCommunityReports();
    res.json({ reports });
  });

  app.post('/api/reports', reportWriteLimiter, (req, res) => {
    try {
      const created = createCommunityReport(req.body);
      res.status(201).json({ report: created });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid community report submission.';
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/reports/:id/upvote', reportWriteLimiter, (req, res) => {
    const updated = upvoteCommunityReport(req.params.id);
    if (!updated) {
      res.status(404).json({ error: 'Report not found.' });
      return;
    }
    res.json({ report: updated });
  });

  app.post('/api/chat', chatLimiter, async (req, res) => {
    try {
      const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
      if (!message || message.length > 1000) {
        res.status(400).json({ error: 'Please provide a question under 1000 characters.' });
        return;
      }

      const reply = await generateEnvironmentalReply({
        message,
        history: Array.isArray(req.body?.history) ? req.body.history : [],
        context: typeof req.body?.context === 'object' ? req.body.context : undefined,
      });

      res.json({ reply });
    } catch (err) {
      const status =
        typeof (err as { statusCode?: number; status?: number })?.statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : typeof (err as { status?: number })?.status === 'number'
            ? (err as { status: number }).status
            : 502;
      const rawMsg = err instanceof Error ? err.message : 'Assistant request failed.';
      let friendly = rawMsg;
      if (rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
        friendly = 'Please verify your GEMINI_API_KEY in Settings > Secrets.';
      } else if (rawMsg.includes('RESOURCE_EXHAUSTED')) {
        friendly = 'Gemini API quota reached temporarily. Please try again shortly.';
      }
      res.status(status >= 400 && status < 600 ? status : 502).json({ error: friendly });
    }
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const port = Number(process.env.PORT ?? 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`VayuMitra server listening on http://0.0.0.0:${port}`);
  });
}

if (process.env.VITEST !== 'true') {
  startServer().catch((err) => {
    console.error('Failed to start VayuMitra server:', err);
    process.exit(1);
  });
}
