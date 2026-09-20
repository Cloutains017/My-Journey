"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type L from "leaflet";
import type { Trip } from "@/lib/types";
import { formatDateRange, RATING_LABELS } from "@/lib/types";
import { matchCityBoundary, groupTripsByCity, PIN_LOCATIONS } from "@/lib/city-data";
import type { FeatureCollection } from "@/lib/city-data";
import { wgs84ToGcj02 } from "@/lib/coords";

// ---- Rating color map ----
const RATING_COLORS: Record<number, string> = {
  1: "#6b7280", 2: "#94a3b8", 3: "#66bb6a", 4: "#ffa726", 5: "#ff6b6b",
};
function color(r: number) { return RATING_COLORS[r] ?? "#ff6b6b"; }

// ---- Gaode dark tile URL (Chinese labels, GCJ-02) ----
const GAODE_URL =
  "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";

// ---- CARTO fallback (English labels, WGS-84) ----
const CARTO_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

// ---- Shared Leaflet import (dedup across effects) ----
let _L: typeof import("leaflet") | null = null;
async function getLeaflet() {
  if (!_L) _L = await import("leaflet");
  return _L;
}

// ---- Client-side GeoJSON cache ----
let _boundariesCache: FeatureCollection | null = null;
async function loadBoundaries(): Promise<FeatureCollection | null> {
  if (_boundariesCache) return _boundariesCache;
  try {
    const res = await fetch("/api/city-boundaries");
    if (res.ok) {
      _boundariesCache = await res.json();
      return _boundariesCache;
    }
  } catch { /* ignore */ }
  return null;
}

export default function HeroMap({ trips }: { trips: Trip[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const [mapReady, setMapReady] = useState(false);

  // --- Init map ---
  useEffect(() => {
    if (!mapRef.current) return;

    getLeaflet().then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, {
        center: [35, 115],
        zoom: 4,
        scrollWheelZoom: false,
        dragging: true,
        zoomControl: false,
        attributionControl: false,
        renderer: L.canvas(),
      });

      // Gaode tiles with CARTO fallback
      let tileFailCount = 0;
      const gaode = L.tileLayer(GAODE_URL, {
        maxZoom: 18,
        subdomains: ["1", "2", "3", "4"],
      }).addTo(map);

      gaode.on("tileerror", () => {
        tileFailCount++;
        if (tileFailCount >= 5) {
          gaode.remove();
          L.tileLayer(CARTO_URL, { maxZoom: 19 }).addTo(map);
          tileFailCount = -999;
        }
      });

      mapInstanceRef.current = map;
      setMapReady(true);
    });

    return () => {
      setMapReady(false);
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // --- Render city polygons + markers ---
  useEffect(() => {
    if (!mapReady || trips.length === 0) return;

    getLeaflet().then(async (L) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      // Clear previous
      layersRef.current.forEach((l) => l.remove());
      layersRef.current = [];

      // Load city boundary GeoJSON (cached after first fetch)
      const geoJSON = await loadBoundaries();

      // Group trips by city name (prefer explicit city_name, fall back to parsing location)
      const cityMap = groupTripsByCity(trips);

      cityMap.forEach((cityTrips, cityName) => {
        const avgRating = Math.round(cityTrips.reduce((s, t) => s + t.rating, 0) / cityTrips.length);
        const c = color(avgRating);

        // Try boundary polygon (use city_name as the primary key for matching)
        const feature = geoJSON
          ? matchCityBoundary(cityName, geoJSON)
          : null;

        if (feature) {
          // Glow halo
          const glow = L.geoJSON(feature, {
            style: () => ({
              color: c, weight: 8, opacity: 0.15,
              fillColor: "transparent", fillOpacity: 0,
            }),
          }).addTo(map);

          // Fill + border (solid line, outer perimeter only)
          const main = L.geoJSON(feature, {
            style: () => ({
              color: c, weight: 2, opacity: 0.8,
              fillColor: c, fillOpacity: 0.1,
            }),
          }).addTo(map);

          // Popup — each trip row is clickable (detail page + scroll to timeline)
          const html = cityTrips.map(
            (t) => {
              const year = t.date.slice(0, 4);
              return `
                <div style="margin:4px 0;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:space-between;gap:6px;">
                  <a href="/trip/${t.slug}" style="color:#fff;text-decoration:none;font-size:12px;border-left:2px solid ${color(t.rating)};padding-left:6px;flex:1;min-width:0;" title="查看详情">
                    <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.title}</div>
                    <div style="color:#888;font-size:10px;">${formatDateRange(t.date, t.end_date)}</div>
                  </a>
                  <a href="/#year-${year}" style="color:#888;text-decoration:none;font-size:10px;padding:3px 6px;border-radius:4px;background:rgba(255,255,255,0.08);white-space:nowrap;flex-shrink:0;" title="滚动到时间轴">📍定位</a>
                </div>`;
            }
          ).join("");
          main.bindPopup(`
            <div style="color:#fff;background:#252320;padding:10px 14px;border-radius:10px;font-family:system-ui;min-width:200px;max-width:280px;">
              <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${cityName}</div>
              ${html}
            </div>
          `);

          // Hover
          main.on("mouseover", () => {
            main.setStyle({ fillOpacity: 0.25, opacity: 1, weight: 3 });
            glow.setStyle({ opacity: 0.35, weight: 14 });
          });
          main.on("mouseout", () => {
            main.setStyle({ color: c, weight: 2, opacity: 0.8, fillColor: c, fillOpacity: 0.1 });
            glow.setStyle({ color: c, weight: 8, opacity: 0.15, fillColor: "transparent", fillOpacity: 0 });
          });

          layersRef.current.push(glow, main);
        } else {
          // No boundary found — show clickable circle marker with pulse ring
          const gcj = wgs84ToGcj02(cityTrips[0].latitude, cityTrips[0].longitude);

          const pulse = L.circleMarker([gcj.lat, gcj.lng], {
            radius: 14, fillColor: c, color: c,
            weight: 1.5, opacity: 0.35, fillOpacity: 0.12,
          }).addTo(map);

          const circle = L.circleMarker([gcj.lat, gcj.lng], {
            radius: 7, fillColor: c, color: c,
            weight: 2, opacity: 0.9, fillOpacity: 0.45,
          }).addTo(map);

          const html = cityTrips.map(
            (t) => {
              const year = t.date.slice(0, 4);
              return `
                <div style="margin:4px 0;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:space-between;gap:6px;">
                  <a href="/trip/${t.slug}" style="color:#fff;text-decoration:none;font-size:12px;border-left:2px solid ${color(t.rating)};padding-left:6px;flex:1;min-width:0;" title="查看详情">
                    <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.title}</div>
                    <div style="color:#888;font-size:10px;">${formatDateRange(t.date, t.end_date)}</div>
                  </a>
                  <a href="/#year-${year}" style="color:#888;text-decoration:none;font-size:10px;padding:3px 6px;border-radius:4px;background:rgba(255,255,255,0.08);white-space:nowrap;flex-shrink:0;" title="滚动到时间轴">📍定位</a>
                </div>`;
            }
          ).join("");
          const popupContent = `
            <div style="color:#fff;background:#252320;padding:10px 14px;border-radius:10px;font-family:system-ui;min-width:200px;max-width:280px;">
              <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${cityTrips[0].location}</div>
              ${html}
            </div>
          `;

          circle.bindPopup(popupContent);
          // Explicit click handler on the larger pulse ring for easier targeting
          pulse.bindPopup(popupContent);

          circle.on("mouseover", () => {
            pulse.setRadius(22); pulse.setStyle({ opacity: 0.6, weight: 2 });
          });
          circle.on("mouseout", () => {
            pulse.setRadius(14); pulse.setStyle({ opacity: 0.35, weight: 1.5 });
          });

          layersRef.current.push(pulse, circle);
        }
      });

      // --- Highlighted pin markers (always visible) ---
      PIN_LOCATIONS.forEach((pin) => {
        const gcj = wgs84ToGcj02(pin.lat, pin.lng);
        const pinIcon = L.divIcon({
          className: "pin-marker",
          html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="26" height="39"><path d="M12 0C5.37 0 0 5.37 0 12c0 7.85 9.13 19.62 12 24 2.87-4.38 12-16.15 12-24C24 5.37 18.63 0 12 0z" fill="#e8a55a" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="10" r="4" fill="#fff" opacity="0.9"/></svg>`,
          iconSize: [26, 39],
          iconAnchor: [13, 39],
          popupAnchor: [0, -39],
        });
        const marker = L.marker([gcj.lat, gcj.lng], { icon: pinIcon }).addTo(map);
        marker.bindPopup(`
          <div style="color:#fff;background:#252320;padding:10px 14px;border-radius:10px;font-family:system-ui;min-width:140px;text-align:center;">
            <div style="font-weight:700;font-size:14px;">📍 ${pin.label || pin.name}</div>
          </div>
        `);
        layersRef.current.push(marker);
      });
    });
  }, [trips, mapReady]);

  return (
    <div className="relative w-full h-[500px] overflow-hidden">
      <div ref={mapRef} className="w-full h-full" role="img" aria-label="旅行足迹地图" />

      {/* Rating legend */}
      <div className="absolute top-4 right-4 z-[1000] rounded-xl bg-black/55 backdrop-blur-xl border border-white/[0.12] px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <div className="text-[10px] uppercase tracking-[2px] text-white/35 mb-2.5 font-sans font-medium">评级</div>
        <div className="flex flex-col gap-1.5">
          {[5, 4, 3, 2, 1].map((v) => (
            <div key={v} className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/20"
                style={{ backgroundColor: RATING_COLORS[v] }}
              />
              <span className="text-xs text-white/80 font-sans leading-none">
                {RATING_LABELS[v]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute right-4 bottom-6 z-[1000] flex flex-col rounded-xl overflow-hidden bg-black/55 backdrop-blur-xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="w-9 h-9 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors text-lg leading-none select-none"
          aria-label="放大"
        >
          +
        </button>
        <div className="h-px bg-white/[0.12]" />
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="w-9 h-9 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors text-lg leading-none select-none"
          aria-label="缩小"
        >
          −
        </button>
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-canvas to-transparent pointer-events-none" />
    </div>
  );
}
