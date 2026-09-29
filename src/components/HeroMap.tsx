"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type L from "leaflet";
import type { Trip, Education } from "@/lib/types";
import { RATING_LABELS } from "@/lib/types";
import type { FeatureCollection } from "@/lib/city-data";
import { addJourneyLayers } from "@/lib/map-journey-layers";
import { EDUCATION_COLOR, RATING_COLORS } from "@/lib/education-map";

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

export default function HeroMap({ trips, education }: { trips: Trip[]; education: Education[] }) {
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
    if (!mapReady) return;
    let cancelled = false;

    getLeaflet().then(async (L) => {
      const map = mapInstanceRef.current;
      if (!map || cancelled) return;

      // Clear previous
      layersRef.current.forEach((l) => l.remove());
      layersRef.current = [];

      // Load city boundary GeoJSON (cached after first fetch)
      const geoJSON = await loadBoundaries();
      if (cancelled || mapInstanceRef.current !== map) return;

      layersRef.current.push(...addJourneyLayers(L, map, trips, education, geoJSON).layers);

    });
    return () => { cancelled = true; };
  }, [trips, education, mapReady]);

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
          <div className="mt-1 flex items-center gap-2.5 border-t border-white/15 pt-2">
            <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20" style={{ backgroundColor: EDUCATION_COLOR }} />
            <span className="text-xs text-white/80 font-sans">求学经历</span>
          </div>
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
