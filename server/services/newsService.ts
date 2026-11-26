import type { ClimateNewsArticle } from '../../src/types/airQuality.ts';
import { MemoryCache, quotaTracker } from '../middleware/rateLimiter.ts';

const newsCache = new MemoryCache<ClimateNewsArticle[]>();

const EDITORIAL_IMAGES = {
  urban: '/src/assets/images/climate_urban_skyline_1795666134700.jpg',
  energy: '/src/assets/images/climate_clean_energy_1795666134790.jpg',
  station: '/src/assets/images/climate_atmospheric_station_1795666136352.jpg',
};

function stripHtmlAndCdata(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/Continue reading\.\.\./gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(xmlBlock: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = regex.exec(xmlBlock);
  return match ? match[1] : '';
}

function classifyArticle(
  title: string,
): { category: ClimateNewsArticle['category']; imageUrl: string } {
  const lower = title.toLowerCase();
  if (lower.includes('solar') || lower.includes('wind') || lower.includes('energy') || lower.includes('grid') || lower.includes('coal') || lower.includes('oil')) {
    return { category: 'Clean Energy', imageUrl: EDITORIAL_IMAGES.energy };
  }
  if (lower.includes('air') || lower.includes('smog') || lower.includes('pm2.5') || lower.includes('pollution') || lower.includes('smoke')) {
    return { category: 'Air Quality', imageUrl: EDITORIAL_IMAGES.urban };
  }
  if (lower.includes('cop') || lower.includes('policy') || lower.includes('treaty') || lower.includes('emissions') || lower.includes('ban') || lower.includes('summit')) {
    return { category: 'Climate Policy', imageUrl: EDITORIAL_IMAGES.urban };
  }
  return { category: 'Atmospheric Science', imageUrl: EDITORIAL_IMAGES.station };
}

function isSafeHttpsUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseRssFeed(xml: string, sourceName: string): ClimateNewsArticle[] {
  const items: ClimateNewsArticle[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = itemRegex.exec(xml)) !== null && items.length < 9) {
    const block = match[1];
    const title = stripHtmlAndCdata(extractTag(block, 'title'));
    const link = stripHtmlAndCdata(extractTag(block, 'link'));
    const description = stripHtmlAndCdata(extractTag(block, 'description'));
    const pubDateRaw = stripHtmlAndCdata(extractTag(block, 'pubDate'));

    if (!title || !isSafeHttpsUrl(link)) continue;

    const parsedDate = pubDateRaw ? new Date(pubDateRaw) : new Date();
    const publishedAt = Number.isNaN(parsedDate.getTime())
      ? new Date().toISOString()
      : parsedDate.toISOString();

    const { category, imageUrl } = classifyArticle(`${title} ${description}`);
    const summary =
      description.length > 210 ? `${description.slice(0, 207).trim()}...` : description;

    items.push({
      id: `${sourceName.toLowerCase().replace(/\s+/g, '-')}-${idx++}`,
      title,
      summary:
        summary ||
        'Environmental reporting on atmospheric shifts, urban emissions, and climate resilience.',
      source: sourceName,
      publishedAt,
      url: link,
      category,
      imageUrl,
    });
  }

  return items;
}

async function fetchRssSource(
  url: string,
  sourceName: string,
): Promise<ClimateNewsArticle[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    quotaTracker.recordUpstream('news');
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'VayuMitra-ClimateFeed/1.0',
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRssFeed(xml, sourceName);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchClimateNews(): Promise<ClimateNewsArticle[]> {
  const cached = newsCache.get('climate-news');
  if (cached) return cached;

  const guardianArticles = await fetchRssSource(
    'https://www.theguardian.com/environment/climate-crisis/rss',
    'The Guardian Climate',
  );
  if (guardianArticles.length > 0) {
    newsCache.set('climate-news', guardianArticles, 15 * 60 * 1000);
    return guardianArticles;
  }

  const bbcArticles = await fetchRssSource(
    'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    'BBC Science & Environment',
  );
  if (bbcArticles.length > 0) {
    newsCache.set('climate-news', bbcArticles, 15 * 60 * 1000);
    return bbcArticles;
  }

  throw new Error('Live climate news feeds are temporarily unreachable.');
}
