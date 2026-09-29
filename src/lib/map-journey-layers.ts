import type * as Leaflet from "leaflet";
import type { Trip, Education } from "./types";
import { formatDateRange } from "./types";
import type { FeatureCollection } from "./city-data";
import { getCityDisplayName, matchCityBoundary } from "./city-data";
import { mapPoint } from "./coords";
import { EDUCATION_COLOR, RATING_COLORS, groupMapRecords } from "./education-map";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function popupContent(name: string, trips: Trip[], education: Education[]): string {
  const rows = [
    ...trips.map(trip => ({ date: trip.date, html: `
      <div style="margin:4px 0;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <a href="/trip/${escapeHtml(encodeURIComponent(trip.slug))}" style="color:#fff;text-decoration:none;font-size:12px;border-left:2px solid ${RATING_COLORS[trip.rating]};padding-left:6px;flex:1;min-width:0;" title="查看详情">
          <div style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(trip.title)}</div>
          <div style="color:#aaa;font-size:10px;">${escapeHtml(formatDateRange(trip.date, trip.end_date))}</div>
        </a>
        <a href="/#year-${escapeHtml(trip.date.slice(0, 4))}" style="color:#aaa;text-decoration:none;font-size:10px;padding:3px 6px;border-radius:4px;background:rgba(255,255,255,.08);white-space:nowrap;">📍定位</a>
      </div>` })),
    ...education.map(item => ({ date: item.date, html: `
      <a href="/#education-${escapeHtml(encodeURIComponent(item.id))}" style="display:block;color:#fff;text-decoration:none;border-left:2px solid ${EDUCATION_COLOR};padding:6px 8px;margin:4px 0;background:rgba(255,255,255,.05);border-radius:6px;">
        <span style="display:block;font-size:12px;font-weight:600;">${escapeHtml(item.degree)} · ${escapeHtml(item.school)}</span>
        <span style="display:block;color:#aaa;font-size:10px;">${escapeHtml(item.date)} 开始 · 查看卡片 →</span>
      </a>` })),
  ];
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return `<div style="color:#fff;background:#252320;padding:10px 14px;border-radius:10px;font-family:system-ui;min-width:200px;max-width:280px;max-height:220px;overflow-y:auto;">
    <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${escapeHtml(name)}</div>${rows.map(row => row.html).join("")}
  </div>`;
}

/** Draw one interactive shape and one popup for each city, including its schools. */
export function addJourneyLayers(
  L: typeof Leaflet,
  map: Leaflet.Map,
  trips: Trip[],
  education: Education[],
  boundaries: FeatureCollection | null,
): { layers: Leaflet.Layer[]; focus: Map<string, () => void> } {
  const layers: Leaflet.Layer[] = [];
  const focus = new Map<string, () => void>();

  for (const [key, group] of groupMapRecords(trips, education)) {
    const c = group.color;
    const name = getCityDisplayName(key, [...group.trips, ...group.education]);
    const popup = popupContent(name, group.trips, group.education);
    const feature = group.domestic && boundaries ? matchCityBoundary(key, boundaries) : null;

    if (group.domestic) {
      if (!feature) continue;
      const glow = L.geoJSON(feature, { style: { color: c, weight: 8, opacity: .15, fillColor: "transparent", fillOpacity: 0 } }).addTo(map);
      const region = L.geoJSON(feature, { style: { color: c, weight: 2, opacity: .8, fillColor: c, fillOpacity: .1 } }).addTo(map);
      region.bindPopup(popup);
      region.on("mouseover", () => {
        region.setStyle({ fillOpacity: .25, opacity: 1, weight: 3 });
        glow.setStyle({ opacity: .35, weight: 14 });
      });
      region.on("mouseout", () => {
        region.setStyle({ color: c, weight: 2, opacity: .8, fillColor: c, fillOpacity: .1 });
        glow.setStyle({ color: c, weight: 8, opacity: .15, fillColor: "transparent", fillOpacity: 0 });
      });
      for (const item of group.education) {
        focus.set(item.id, () => {
          map.once("moveend", () => region.openPopup());
          map.flyToBounds(region.getBounds(), { maxZoom: 8 });
        });
      }
      layers.push(glow, region);
      continue;
    }

    // Overseas entries share the trip's existing point. Education-only places use rose gold.
    const first = group.trips[0] ?? group.education[0];
    const point = mapPoint(first.latitude, first.longitude, true);
    const halo = L.circleMarker([point.lat, point.lng], { radius: 14, fillColor: c, color: c, weight: 1.5, opacity: .35, fillOpacity: .12 }).addTo(map);
    const marker = L.circleMarker([point.lat, point.lng], { radius: 7, fillColor: c, color: c, weight: 2, opacity: .9, fillOpacity: .45 }).addTo(map);
    halo.bindPopup(popup);
    marker.bindPopup(popup);
    marker.on("mouseover", () => { halo.setRadius(22); halo.setStyle({ opacity: .6, weight: 2 }); });
    marker.on("mouseout", () => { halo.setRadius(14); halo.setStyle({ opacity: .35, weight: 1.5 }); });
    for (const item of group.education) {
      focus.set(item.id, () => {
        map.once("moveend", () => marker.openPopup());
        map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 9));
      });
    }
    layers.push(halo, marker);
  }
  return { layers, focus };
}
