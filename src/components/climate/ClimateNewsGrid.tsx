import { ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getClimateNews } from '../../services/apiClient.ts';
import type { ClimateNewsArticle } from '../../types/airQuality.ts';

type NewsFilter = 'All' | ClimateNewsArticle['category'];

export function ClimateNewsGrid() {
  const [articles, setArticles] = useState<ClimateNewsArticle[]>([]);
  const [filter, setFilter] = useState<NewsFilter>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [failedImgs, setFailedImgs] = useState<Record<string, boolean>>({});

  const loadNews = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getClimateNews();
      setArticles(res.articles);
      setIsOffline(res.isOfflineFallback);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch climate news.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, []);

  const visible =
    filter === 'All' ? articles : articles.filter((a) => a.category === filter);

  return (
    <section
      aria-label="Recent climate change and air quality journalism"
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Global Environmental Dispatches {isOffline ? '· Offline Cache' : ''}
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mt-0.5">
            Climate &amp; Atmospheric Science News
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Filter climate news by topic"
            className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E17] border border-slate-200 dark:border-slate-800"
          >
            {(
              ['All', 'Air Quality', 'Climate Policy', 'Clean Energy', 'Atmospheric Science'] as const
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === cat
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-cyan-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadNews}
            aria-label="Refresh climate news"
            className="p-2 min-h-[36px] min-w-[36px] rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-sky-500 dark:hover:border-cyan-400 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-lg border border-rose-500/40 bg-rose-500/10 text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-4"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadNews}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600 text-white cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {isLoading && articles.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-64 rounded-lg bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.slice(0, 6).map((article) => (
            <article
              key={article.id}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0B0E17] overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-900 relative">
                  {!failedImgs[article.id] ? (
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setFailedImgs((prev) => ({ ...prev, [article.id]: true }))
                      }
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-950 flex flex-col items-center justify-center p-4 text-slate-400">
                      <Newspaper className="w-7 h-7 mb-2 text-cyan-400" aria-hidden="true" />
                      <span className="text-xs text-center">{article.category}</span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-sky-700 dark:text-cyan-400">
                      {article.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{article.source}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                  </div>

                  <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    {article.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                    {article.summary}
                  </p>
                </div>
              </div>

              <div className="px-4 pb-4 pt-1">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-cyan-400 dark:hover:text-cyan-300"
                >
                  <span>Read Full Dispatch</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
