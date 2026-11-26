import fs from 'node:fs';
import path from 'node:path';
import type {
  CommunityReport,
  IncidentCategory,
  IncidentSeverity,
} from '../../src/types/airQuality.ts';

const ALLOWED_CATEGORIES: IncidentCategory[] = [
  'Industrial Smoke',
  'Waste Burning',
  'Vehicular Emissions',
  'Construction Dust',
  'Chemical Odor',
];

const ALLOWED_SEVERITIES: IncidentSeverity[] = ['Low', 'Moderate', 'High', 'Critical'];

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');
const REPORTS_FILE = path.resolve(DATA_DIR, 'reports.json');

if (!REPORTS_FILE.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid reports file path configuration.');
}

const SEED_REPORTS: CommunityReport[] = [
  {
    id: 'rep-seed-1',
    title: 'Dense diesel exhaust bottleneck along arterial ring road',
    category: 'Vehicular Emissions',
    severity: 'High',
    description:
      'Heavy freight idling during evening peak hour producing visible brown haze and elevated roadside particulate levels.',
    locationName: 'Anand Vihar Transit Corridor, New Delhi',
    latitude: 28.6469,
    longitude: 77.316,
    photoDataUrl: '/src/assets/images/climate_urban_skyline_1795666134700.jpg',
    reporterName: 'Aarav Mehta',
    upvotes: 14,
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: 'rep-seed-2',
    title: 'Uncovered demolition debris cloud near metro excavation',
    category: 'Construction Dust',
    severity: 'Moderate',
    description:
      'Dry excavation work without misting cannons generating coarse PM10 dust plumes drifting toward nearby school blocks.',
    locationName: 'Lower Parel East, Mumbai',
    latitude: 19.0022,
    longitude: 72.8302,
    photoDataUrl: '/src/assets/images/climate_atmospheric_station_1795666136352.jpg',
    reporterName: 'Priya Nair',
    upvotes: 9,
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
  },
];

function ensureStore(): CommunityReport[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(REPORTS_FILE)) {
      fs.writeFileSync(REPORTS_FILE, JSON.stringify(SEED_REPORTS, null, 2), 'utf8');
      return [...SEED_REPORTS];
    }
    const raw = fs.readFileSync(REPORTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CommunityReport[]) : [...SEED_REPORTS];
  } catch {
    return [...SEED_REPORTS];
  }
}

function persistReports(reports: CommunityReport[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports.slice(0, 100), null, 2), 'utf8');
}

export function listCommunityReports(): CommunityReport[] {
  return ensureStore().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function createCommunityReport(input: unknown): CommunityReport {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid report payload.');
  }
  const body = input as Record<string, unknown>;

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const locationName = typeof body.locationName === 'string' ? body.locationName.trim() : '';
  const reporterName =
    typeof body.reporterName === 'string' && body.reporterName.trim().length > 0
      ? body.reporterName.trim().slice(0, 60)
      : 'Community Observer';

  const category = body.category as IncidentCategory;
  const severity = body.severity as IncidentSeverity;
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);

  if (title.length < 4 || title.length > 140) {
    throw new Error('Title must be between 4 and 140 characters.');
  }
  if (description.length < 10 || description.length > 1200) {
    throw new Error('Description must be between 10 and 1200 characters.');
  }
  if (locationName.length < 2 || locationName.length > 160) {
    throw new Error('Location name is required.');
  }
  if (!ALLOWED_CATEGORIES.includes(category)) {
    throw new Error('Unsupported pollution incident category.');
  }
  if (!ALLOWED_SEVERITIES.includes(severity)) {
    throw new Error('Unsupported incident severity level.');
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90.');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180.');
  }

  let photoDataUrl: string | null = null;
  if (body.photoDataUrl !== null && body.photoDataUrl !== undefined && body.photoDataUrl !== '') {
    if (typeof body.photoDataUrl !== 'string') {
      throw new Error('Invalid photo format.');
    }
    const isAllowedImage = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
      body.photoDataUrl,
    );
    if (!isAllowedImage) {
      throw new Error('Photo must be a valid JPEG, PNG, or WebP image.');
    }
    if (body.photoDataUrl.length > 2_000_000) {
      throw new Error('Uploaded photo exceeds the 1.5 MB limit after compression.');
    }
    photoDataUrl = body.photoDataUrl;
  }

  const reports = ensureStore();
  const created: CommunityReport = {
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    category,
    severity,
    description,
    locationName,
    latitude: Math.round(latitude * 10000) / 10000,
    longitude: Math.round(longitude * 10000) / 10000,
    photoDataUrl,
    reporterName,
    upvotes: 1,
    createdAt: new Date().toISOString(),
  };

  reports.unshift(created);
  persistReports(reports);
  return created;
}

export function upvoteCommunityReport(reportId: string): CommunityReport | null {
  if (!/^rep-[a-zA-Z0-9-]+$/.test(reportId)) {
    return null;
  }
  const reports = ensureStore();
  const target = reports.find((r) => r.id === reportId);
  if (!target) return null;
  target.upvotes += 1;
  persistReports(reports);
  return target;
}
