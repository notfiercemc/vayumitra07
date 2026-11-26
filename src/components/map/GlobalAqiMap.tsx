import L from 'leaflet';
import { AlertTriangle, Crosshair, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AQI_LEVELS, getAqiLevel } from '../../constants/aqiScale.ts';
import { reverseGeocode } from '../../services/apiClient.ts';
import type { AirQualitySnapshot, GeoLocation, GlobalHubPin } from '../../types/airQuality.ts';

interface GlobalAqiMapProps {
  hubs: GlobalHubPin[];
  hubsError: string | null;
  onRetryHubs: () => void;
  activeSnapshot: AirQualitySnapshot | null;
  isDark: boolean;
  onSelectCoordinates: (loc: GeoLocation) => void;
}

type MapMetricMode = 'aqi' | 'pm25' | 'temp';

function getPinColorAndLabel(
  mode: MapMetricMode,
  aqi: number,
  pm25: number | null,
  tempC: number,
): { hex: string; label: string; symbol: string; valueText: string } {
  if (mode === 'pm25') {
    const val = pm25 ?? 0;
    if (val <= 12) return { hex: '#10B981', label: 'Good (≤12 µg/m³)', symbol: '●', valueText: pm25 !== null ? `${Math.round(val)}` : '--' };
    if (val <= 35.4) return { hex: '#F59E0B', label: 'Moderate (12–35 µg/m³)', symbol: '◆', valueText: `${Math.round(val)}` };
    if (val <= 55.4) return { hex: '#F97316', label: 'Elevated (35–55 µg/m³)', symbol: '▲', valueText: `${Math.round(val)}` };
    if (val <= 150.4) return { hex: '#EF4444', label: 'Unhealthy (55–150 µg/m³)', symbol: '■', valueText: `${Math.round(val)}` };
    return { hex: '#C084FC', label: 'Severe (>150 µg/m³)', symbol: '✖', valueText: `${Math.round(val)}` };
  }

  if (mode === 'temp') {
    if (tempC < 10) return { hex: '#38BDF8', label: 'Cool (<10°C)', symbol: '●', valueText: `${Math.round(tempC)}°` };
    if (tempC < 22) return { hex: '#10B981', label: 'Mild (10–21°C)', symbol: '◆', valueText: `${Math.round(tempC)}°` };
    if (tempC < 30) return { hex: '#F59E0B', label: 'Warm (22–29°C)', symbol: '▲', valueText: `${Math.round(tempC)}°` };
    return { hex: '#EF4444', label: 'Hot (≥30°C)', symbol: '■', valueText: `${Math.round(tempC)}°` };
  }

  const level = getAqiLevel(aqi);
  return { hex: level.hex, label: level.label, symbol: level.symbol, valueText: String(aqi) };
}

function createGraticuleFallbackLayer(isDark: boolean): L.GridLayer {
  const GridLayer = L.GridLayer.extend({
    createTile: function () {
      const tile = document.createElement('canvas');
      const size = this.getTileSize();
      tile.width = size.x;
      tile.height = size.y;
      const ctx = tile.getContext('2d');
      if (ctx) {
        ctx.fillStyle = isDark ? '#0B0E17' : '#F1F5F9';
        ctx.fillRect(0, 0, size.x, size.y);
        ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.1)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, size.x, size.y);
        ctx.beginPath();
        ctx.moveTo(size.x / 2, 0);
        ctx.lineTo(size.x / 2, size.y);
        ctx.moveTo(0, size.y / 2);
        ctx.lineTo(size.x, size.y / 2);
        ctx.stroke();
      }
      return tile;
    },
  });
  return new (GridLayer as unknown as new () => L.GridLayer)();
}

export function GlobalAqiMap({
  hubs,
  hubsError,
  onRetryHubs,
  activeSnapshot,
  isDark,
  onSelectCoordinates,
}: GlobalAqiMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.Layer | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const [metricMode, setMetricMode] = useState<MapMetricMode>('aqi');
  const [useFallbackGrid, setUseFallbackGrid] = useState(false);
  const [isSamplingPin, setIsSamplingPin] = useState(false);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapElementRef.current || mapInstanceRef.current) return;

    const map = L.map(mapElementRef.current, {
      center: [24, 15],
      zoom: 2,
      minZoom: 2,
      maxZoom: 15,
      worldCopyJump: true,
      zoomControl: true,
    });

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markerLayerRef.current = layerGroup;

    map.on('click', async (ev: L.LeafletMouseEvent) => {
      const lat = Math.round(ev.latlng.lat * 10000) / 10000;
      const lon = Math.round(ev.latlng.lng * 10000) / 10000;
      setIsSamplingPin(true);
      try {
        const resolved = await reverseGeocode(lat, lon);
        onSelectCoordinates(resolved);
      } finally {
        setIsSamplingPin(false);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markerLayerRef.current = null;
    };
  }, [onSelectCoordinates]);

  // Key-free OpenStreetMap tile layer with automatic Canvas Graticule fallback on tileerror
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
      tileLayerRef.current = null;
    }

    if (useFallbackGrid) {
      tileLayerRef.current = createGraticuleFallbackLayer(isDark).addTo(map);
      return;
    }

    let errorCount = 0;
    const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
      crossOrigin: true,
    });

    osmLayer.on('tileerror', () => {
      errorCount += 1;
      if (errorCount >= 4) {
        setUseFallbackGrid(true);
      }
    });

    tileLayerRef.current = osmLayer.addTo(map);
  }, [isDark, useFallbackGrid]);

  // Render global hub pins + active searched location pin
  useEffect(() => {
    const layer = markerLayerRef.current;
    const map = mapInstanceRef.current;
    if (!layer || !map) return;

    layer.clearLayers();

    const pinsToRender: Array<{
      id: string;
      name: string;
      country: string;
      latitude: number;
      longitude: number;
      aqi: number;
      pm25: number | null;
      temperatureC: number;
      windSpeedKmh: number;
      isSelected: boolean;
    }> = hubs.map((h) => ({
      ...h,
      isSelected:
        !!activeSnapshot &&
        Math.abs(h.latitude - activeSnapshot.location.latitude) < 0.08 &&
        Math.abs(h.longitude - activeSnapshot.location.longitude) < 0.08,
    }));

    if (activeSnapshot && !pinsToRender.some((p) => p.isSelected)) {
      pinsToRender.push({
        id: activeSnapshot.location.id,
        name: activeSnapshot.location.name,
        country: activeSnapshot.location.country,
        latitude: activeSnapshot.location.latitude,
        longitude: activeSnapshot.location.longitude,
        aqi: activeSnapshot.aqi,
        pm25: activeSnapshot.pollutants.pm25,
        temperatureC: activeSnapshot.weather.temperatureC,
        windSpeedKmh: activeSnapshot.weather.windSpeedKmh,
        isSelected: true,
      });
    }

    for (const pin of pinsToRender) {
      const styleInfo = getPinColorAndLabel(
        metricMode,
        pin.aqi,
        pin.pm25,
        pin.temperatureC,
      );

      const size = pin.isSelected ? 42 : 34;
      const ring = pin.isSelected
        ? 'box-shadow: 0 0 0 3px rgba(34,211,238,0.85), 0 4px 12px rgba(0,0,0,0.5);'
        : 'box-shadow: 0 2px 6px rgba(0,0,0,0.4);';

      const icon = L.divIcon({
        className: 'vayumitra-aqi-pin',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${styleInfo.hex};color:#07090E;font-family:'JetBrains Mono',monospace;font-weight:700;font-size:${pin.isSelected ? '13px' : '11px'};display:flex;align-items:center;justify-content:center;border:2px solid #FFFFFF;${ring}" aria-label="${escapeHtml(pin.name)}: ${escapeHtml(styleInfo.label)} (${escapeHtml(styleInfo.valueText)})">${escapeHtml(styleInfo.valueText)}</div>`,
      });

      const marker = L.marker([pin.latitude, pin.longitude], { icon });

      const popupEl = document.createElement('div');
      popupEl.className = 'min-w-[200px] space-y-1.5';
      popupEl.innerHTML = `
        <div style="font-weight:600;font-size:13px;">${escapeHtml(pin.name)}</div>
        <div style="font-size:11px;opacity:0.75;">${escapeHtml(pin.country)}</div>
        <div style="display:flex;align-items:center;gap:6px;padding-top:4px;font-family:'JetBrains Mono',monospace;font-size:12px;">
          <span style="color:${styleInfo.hex};font-weight:700;">${styleInfo.symbol} AQI ${pin.aqi}</span>
          <span>·</span>
          <span>${escapeHtml(getAqiLevel(pin.aqi).shortLabel)}</span>
        </div>
        <div style="font-size:11px;opacity:0.88;">
          PM₂.₅: ${pin.pm25 ?? '--'} µg/m³ · Temp: ${pin.temperatureC}°C · Wind: ${pin.windSpeedKmh} km/h
        </div>
      `;

      const focusBtn = document.createElement('button');
      focusBtn.type = 'button';
      focusBtn.textContent = 'Focus Station Telemetry';
      focusBtn.style.cssText =
        'margin-top:6px;width:100%;padding:6px 10px;border-radius:6px;background:#0284c7;color:#fff;font-size:11px;font-weight:600;cursor:pointer;border:none;';
      focusBtn.onclick = () => {
        onSelectCoordinates({
          id: pin.id,
          name: pin.name,
          country: pin.country,
          latitude: pin.latitude,
          longitude: pin.longitude,
        });
      };
      popupEl.appendChild(focusBtn);

      marker.bindPopup(popupEl, { className: 'vayumitra-leaflet-popup' });
      marker.on('click', () => {
        onSelectCoordinates({
          id: pin.id,
          name: pin.name,
          country: pin.country,
          latitude: pin.latitude,
          longitude: pin.longitude,
        });
      });

      marker.addTo(layer);
    }
  }, [hubs, activeSnapshot, metricMode, onSelectCoordinates]);

  // Pan to active searched location
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeSnapshot) return;
    map.flyTo(
      [activeSnapshot.location.latitude, activeSnapshot.location.longitude],
      Math.max(map.getZoom(), 5),
      { duration: 0.65 },
    );
  }, [activeSnapshot?.location.latitude, activeSnapshot?.location.longitude]);

  const handleResetWorldView = () => {
    mapInstanceRef.current?.flyTo([24, 15], 2, { duration: 0.65 });
  };

  return (
    <div className="h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden flex flex-col">
      {/* Map Header Controls */}
      <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Global Atmospheric Sensor Map
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isSamplingPin
              ? 'Resolving coordinates...'
              : 'Click any station pin or sample any coordinate worldwide'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Map pin metric layer"
            className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0B0E17] border border-slate-200 dark:border-slate-800"
          >
            {(
              [
                { id: 'aqi', label: 'US AQI' },
                { id: 'pm25', label: 'PM2.5' },
                { id: 'temp', label: 'Temp' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={metricMode === tab.id}
                onClick={() => setMetricMode(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[30px] ${
                  metricMode === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-cyan-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleResetWorldView}
            title="Reset to global view"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-sky-500 dark:hover:border-cyan-500/60 transition-colors cursor-pointer"
          >
            <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Global View</span>
          </button>
        </div>
      </div>

      {/* Explicit Error/Fallback Status Strip */}
      {(hubsError || useFallbackGrid) && (
        <div
          role="status"
          className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/25 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300"
        >
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              {hubsError
                ? `Global hub feed degraded: ${hubsError}`
                : 'Map basemap unreachable — displaying coordinate graticule grid'}
            </span>
          </span>
          <div className="flex items-center gap-2">
            {useFallbackGrid && (
              <button
                type="button"
                onClick={() => setUseFallbackGrid(false)}
                className="underline font-medium cursor-pointer"
              >
                Retry Map Tiles
              </button>
            )}
            {hubsError && (
              <button
                type="button"
                onClick={onRetryHubs}
                className="inline-flex items-center gap-1 underline font-medium cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>Retry Hubs</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive Leaflet Viewport */}
      <div
        ref={mapElementRef}
        aria-label="Interactive global air quality map"
        className="w-full flex-1 min-h-[380px] sm:min-h-[430px] relative z-10"
      />

      {/* Dynamic Accessible Legend */}
      <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E17] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {metricMode === 'aqi' && (
          <>
            <span className="font-medium text-slate-600 dark:text-slate-400">EPA Scale:</span>
            {AQI_LEVELS.map((lvl) => (
              <span key={lvl.key} className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span aria-hidden="true" style={{ color: lvl.hex }} className="font-mono font-bold">
                  {lvl.symbol}
                </span>
                <span>
                  {lvl.shortLabel} ({lvl.min}–{lvl.max === 500 ? '500+' : lvl.max})
                </span>
              </span>
            ))}
          </>
        )}

        {metricMode === 'pm25' && (
          <>
            <span className="font-medium text-slate-600 dark:text-slate-400">PM₂.₅ (µg/m³):</span>
            {[
              { hex: '#10B981', symbol: '●', text: 'Good (0–12)' },
              { hex: '#F59E0B', symbol: '◆', text: 'Moderate (12–35)' },
              { hex: '#F97316', symbol: '▲', text: 'Elevated (35–55)' },
              { hex: '#EF4444', symbol: '■', text: 'Unhealthy (55–150)' },
              { hex: '#C084FC', symbol: '✖', text: 'Severe (>150)' },
            ].map((item) => (
              <span key={item.text} className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span aria-hidden="true" style={{ color: item.hex }} className="font-mono font-bold">
                  {item.symbol}
                </span>
                <span>{item.text}</span>
              </span>
            ))}
          </>
        )}

        {metricMode === 'temp' && (
          <>
            <span className="font-medium text-slate-600 dark:text-slate-400">Surface Temp:</span>
            {[
              { hex: '#38BDF8', symbol: '●', text: 'Cool (<10°C)' },
              { hex: '#10B981', symbol: '◆', text: 'Mild (10–21°C)' },
              { hex: '#F59E0B', symbol: '▲', text: 'Warm (22–29°C)' },
              { hex: '#EF4444', symbol: '■', text: 'Hot (≥30°C)' },
            ].map((item) => (
              <span key={item.text} className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span aria-hidden="true" style={{ color: item.hex }} className="font-mono font-bold">
                  {item.symbol}
                </span>
                <span>{item.text}</span>
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
