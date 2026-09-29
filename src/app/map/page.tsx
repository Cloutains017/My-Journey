"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TravelImage from "@/components/TravelImage";
import type L from "leaflet";
import { supabase } from "@/lib/supabase";
import type { Trip, Education } from "@/lib/types";
import { DEFAULT_EDUCATION } from "@/lib/education";
import { addJourneyLayers } from "@/lib/map-journey-layers";
import { EDUCATION_COLOR, RATING_COLORS } from "@/lib/education-map";
import { formatDateRange, RATING_LABELS } from "@/lib/types";
import type { FeatureCollection } from "@/lib/city-data";

const GAODE_URL =
  "https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}";
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

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [education, setEducation] = useState<Education[]>(DEFAULT_EDUCATION);
  const [mapReady, setMapReady] = useState(false);

  // Fetch trips
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("trips")
      .select("*")
      .order("date", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.warn("Failed to fetch trips:", error.message); return; }
        if (data) setTrips(data as Trip[]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.from("education").select("*").order("date", { ascending: false }).then(({ data, error }) => {
      if (!cancelled && !error && data) setEducation(data as Education[]);
    });
    return () => { cancelled = true; };
  }, []);

  // Init map
  useEffect(() => {
    if (!mapRef.current) return;

    getLeaflet().then((L) => {
      if (mapInstanceRef.current) return;

      const map = L.map(mapRef.current!, {
        center: [35, 115],
        zoom: 4,
        scrollWheelZoom: true,
        zoomControl: false,
        renderer: L.canvas(),
      });
      map.attributionControl.setPrefix(false);

      let tileFailCount = 0;
      const gaode = L.tileLayer(GAODE_URL, {
        maxZoom: 18,
        subdomains: ["1", "2", "3", "4"],
        attribution: "高德地图",
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
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Render city polygons + markers
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;

    getLeaflet().then(async (L) => {
      const map = mapInstanceRef.current;
      if (!map || cancelled) return;

      layersRef.current.forEach((l) => l.remove());
      layersRef.current = [];

      const geoJSON = await loadBoundaries();
      if (cancelled || mapInstanceRef.current !== map) return;

      const journeyLayers = addJourneyLayers(L, map, trips, education, geoJSON);
      layersRef.current.push(...journeyLayers.layers);
      const selected = new URLSearchParams(window.location.search).get("education");
      if (selected) journeyLayers.focus.get(selected)?.();

    });
    return () => { cancelled = true; };
  }, [trips, education, mapReady]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="relative flex-1 w-full">
        <div ref={mapRef} className="w-full h-full" role="img" aria-label="旅行足迹全屏地图" />

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
              <span className="text-xs text-white/80 font-sans">求学足迹</span>
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
      </div>
      <div className="bg-canvas border-t border-hairline px-4 sm:px-8 py-4 flex gap-3 sm:gap-4 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        {trips.map((trip) => (
          <Link
            key={trip.id}
            href={`/trip/${trip.slug}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-surface-card border border-hairline-soft hover:border-primary/20 hover:shadow-sm flex-shrink-0 min-w-[180px] sm:min-w-[200px] transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-surface-cream-strong flex-shrink-0 overflow-hidden">
              {trip.cover_image && (
                <TravelImage src={trip.cover_image} alt="" width={40} height={40} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{trip.title}</p>
              <p className="text-xs text-muted">{formatDateRange(trip.date, trip.end_date)}</p>
            </div>
          </Link>
        ))}
        {education.map((item) => (
          <Link key={item.id} href={`/#education-${encodeURIComponent(item.id)}`}
            className="flex min-w-[180px] flex-shrink-0 items-center gap-3 rounded-xl border border-[#8A5AB4]/30 bg-[#8A5AB4]/10 p-3 hover:border-[#8A5AB4]">
            <span className="h-3 w-3 rounded-full bg-[#8A5AB4]" />
            <span><span className="block text-sm font-semibold text-ink">{item.degree} · {item.school}</span><span className="text-xs text-muted">{item.date} 开始</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
