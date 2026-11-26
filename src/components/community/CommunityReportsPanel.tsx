import { Camera, CheckCircle2, MapPin, ThumbsUp, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getCommunityReports,
  submitCommunityReport,
  upvoteReport,
} from '../../services/apiClient.ts';
import type {
  CommunityReport,
  GeoLocation,
  IncidentCategory,
  IncidentSeverity,
} from '../../types/airQuality.ts';

interface CommunityReportsPanelProps {
  selectedLocation: GeoLocation;
}

const CATEGORIES: IncidentCategory[] = [
  'Industrial Smoke',
  'Waste Burning',
  'Vehicular Emissions',
  'Construction Dust',
  'Chemical Odor',
];

const SEVERITIES: IncidentSeverity[] = ['Low', 'Moderate', 'High', 'Critical'];

async function compressImageToDataUrl(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Please upload a JPEG, PNG, or WebP photograph.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxDim = 960;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas compression unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function CommunityReportsPanel({ selectedLocation }: CommunityReportsPanelProps) {
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [filterCategory, setFilterCategory] = useState<'All' | IncidentCategory>('All');
  const [filterSeverity, setFilterSeverity] = useState<'All' | IncidentSeverity>('All');
  const [verifiedIds, setVerifiedIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('Waste Burning');
  const [severity, setSeverity] = useState<IncidentSeverity>('Moderate');
  const [locationName, setLocationName] = useState(
    `${selectedLocation.name}, ${selectedLocation.country}`,
  );
  const [reporterName, setReporterName] = useState('');
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLocationName(`${selectedLocation.name}, ${selectedLocation.country}`);
  }, [selectedLocation.name, selectedLocation.country]);

  const loadReports = async () => {
    setIsLoading(true);
    setFeedError(null);
    try {
      const data = await getCommunityReports();
      setReports(data);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : 'Unable to load community reports.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);
    try {
      const compressed = await compressImageToDataUrl(file);
      setPhotoDataUrl(compressed);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to process photo.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (title.trim().length < 4) {
      setFormError('Please provide a concise incident title (at least 4 characters).');
      return;
    }
    if (description.trim().length < 10) {
      setFormError('Please describe what you observed (at least 10 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitCommunityReport({
        title: title.trim(),
        category,
        severity,
        description: description.trim(),
        locationName: locationName.trim() || `${selectedLocation.name}, ${selectedLocation.country}`,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        photoDataUrl,
        reporterName: reporterName.trim() || 'Community Observer',
      });

      setReports((prev) => [res.report, ...prev]);
      setFilterCategory('All');
      setFilterSeverity('All');
      setTitle('');
      setDescription('');
      setPhotoDataUrl(null);
      setFormSuccess(
        res.queuedOffline
          ? 'Saved locally offline. Your report will sync automatically when reconnected.'
          : 'Incident logged and added to the Verified Community Feed.',
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to submit incident report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvote = async (id: string) => {
    if (id.startsWith('pending-') || verifiedIds[id]) return;
    setVerifiedIds((prev) => ({ ...prev, [id]: true }));
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, upvotes: r.upvotes + 1 } : r)),
    );
    try {
      const updated = await upvoteReport(id);
      setReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      // Revert optimistic increment on server error
      setVerifiedIds((prev) => ({ ...prev, [id]: false }));
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, upvotes: Math.max(1, r.upvotes - 1) } : r)),
      );
    }
  };

  const visibleReports = reports.filter((r) => {
    const matchesCat = filterCategory === 'All' || r.category === filterCategory;
    const matchesSev = filterSeverity === 'All' || r.severity === filterSeverity;
    return matchesCat && matchesSev;
  });

  return (
    <section
      aria-label="Community pollution incident reporting"
      className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
    >
      {/* Left: Submit Incident Form */}
      <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
          Log Local Pollution Incident
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Document smoke plumes, open burning, or dust hotspots with optional photo evidence.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="inc-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Incident Headline
            </label>
            <input
              id="inc-title"
              type="text"
              required
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Open plastic burning behind industrial depot"
              className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E17] text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="inc-category" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                id="inc-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E17] text-slate-900 dark:text-slate-100"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="inc-severity" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Severity
              </label>
              <select
                id="inc-severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E17] text-slate-900 dark:text-slate-100"
              >
                {SEVERITIES.map((sev) => (
                  <option key={sev} value={sev}>
                    {sev}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="inc-location" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Location / Neighborhood
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setLocationName(`${selectedLocation.name}, ${selectedLocation.country}`)
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  <MapPin className="w-3 h-3" aria-hidden="true" />
                  <span>Sync Active</span>
                </button>
              </div>
              <input
                id="inc-location"
                type="text"
                required
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E17] text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label htmlFor="inc-reporter" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Your Name (Optional)
              </label>
              <input
                id="inc-reporter"
                type="text"
                maxLength={60}
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Community Observer"
                className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E17] text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="inc-desc" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Observation Details
            </label>
            <textarea
              id="inc-desc"
              rows={3}
              required
              maxLength={1200}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe smoke color, odor, duration, or affected streets..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E17] text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Photo Evidence (JPEG, PNG, or WebP)
            </span>
            <label
              htmlFor="inc-photo"
              className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-[#0B0E17] text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-sky-500 dark:hover:border-cyan-400 cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4 text-sky-600 dark:text-cyan-400" aria-hidden="true" />
              <span>{photoDataUrl ? 'Replace attached photo' : 'Upload incident photograph'}</span>
              <input
                id="inc-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                className="sr-only"
              />
            </label>

            {photoDataUrl && (
              <div className="mt-2.5 relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                <img
                  src={photoDataUrl}
                  alt="Attached pollution incident preview"
                  className="w-full h-36 object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhotoDataUrl(null)}
                  aria-label="Remove attached photo"
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-950/80 text-white hover:bg-slate-900 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {formError && (
            <div role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {formError}
            </div>
          )}

          {formSuccess && (
            <div
              role="status"
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-medium"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{formSuccess}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-lg bg-sky-600 hover:bg-sky-700 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 transition-colors cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? 'Submitting Report...' : 'Submit Community Report'}
          </button>
        </form>
      </div>

      {/* Right: Community Incident Feed */}
      <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
              Verified Community Feed
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Showing {visibleReports.length} of {reports.length} crowdsourced reports
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="feed-severity-filter" className="sr-only">
              Filter by severity
            </label>
            <select
              id="feed-severity-filter"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as 'All' | IncidentSeverity)}
              className="min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E17] text-slate-800 dark:text-slate-200"
            >
              <option value="All">All Severities</option>
              {SEVERITIES.map((sev) => (
                <option key={sev} value={sev}>
                  {sev} Severity
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div
          role="group"
          aria-label="Filter community reports by category"
          className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E17] border border-slate-200 dark:border-slate-800"
        >
          {(['All', ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={filterCategory === cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterCategory === cat
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-cyan-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {feedError && (
          <div role="alert" className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300">
            {feedError}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2].map((n) => (
              <div key={n} className="h-32 rounded-lg bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : visibleReports.length === 0 ? (
          <div className="p-8 text-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E17] space-y-2">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              No community reports match the current category and severity filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterCategory('All');
                setFilterSeverity('All');
              }}
              className="text-xs font-semibold text-sky-700 dark:text-cyan-400 hover:underline cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleReports.map((rep) => {
              const isVerified = rep.upvotes >= 5;
              const statusLabel = rep.pendingSync
                ? 'Pending Sync'
                : isVerified
                  ? 'Community Verified'
                  : 'Logged';
              const hasVoted = !!verifiedIds[rep.id];

              return (
                <article
                  key={rep.id}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0B0E17] flex flex-col sm:flex-row gap-4"
                >
                  {rep.photoDataUrl ? (
                    <button
                      type="button"
                      onClick={() => setLightboxPhoto({ url: rep.photoDataUrl!, title: rep.title })}
                      className="sm:w-36 sm:h-28 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 cursor-pointer group"
                      aria-label={`View enlarged photo for ${rep.title}`}
                    >
                      <img
                        src={rep.photoDataUrl}
                        alt={rep.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-36 sm:h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </button>
                  ) : (
                    <div className="sm:w-36 sm:h-28 shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-1 p-2">
                      <Camera className="w-5 h-5" aria-hidden="true" />
                      <span className="text-[11px]">No photo</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {rep.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            rep.severity === 'Critical' || rep.severity === 'High'
                              ? 'text-rose-700 dark:text-rose-400 font-semibold'
                              : 'text-amber-700 dark:text-amber-300 font-medium'
                          }
                        >
                          {rep.severity} Severity
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{rep.locationName}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            isVerified
                              ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                              : 'text-slate-600 dark:text-slate-400'
                          }
                        >
                          {statusLabel}
                        </span>
                      </div>

                      <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                        {rep.title}
                      </h3>
                      <p className="mt-1 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {rep.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
                      <span>
                        Reported by {rep.reporterName} ·{' '}
                        {new Date(rep.createdAt).toLocaleDateString()}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUpvote(rep.id)}
                        disabled={hasVoted || !!rep.pendingSync}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-md border font-mono tabular-nums transition-colors cursor-pointer disabled:cursor-default ${
                          hasVoted
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-200 dark:border-slate-700 hover:border-sky-500 dark:hover:border-cyan-400 text-slate-800 dark:text-slate-200'
                        }`}
                        aria-label={`Verify incident ${rep.title}, ${rep.upvotes} verifications`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{hasVoted ? `Verified (${rep.upvotes})` : rep.upvotes}</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxPhoto.title}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="max-w-2xl w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <span className="text-sm font-medium text-slate-100 truncate">
                {lightboxPhoto.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                aria-label="Close photo preview"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.title}
              className="w-full max-h-[75vh] object-contain bg-black"
            />
          </div>
        </div>
      )}
    </section>
  );
}
