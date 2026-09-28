import type * as Leaflet from "leaflet";
import type { Education } from "./types";
import type { FeatureCollection } from "./city-data";
import { matchCityBoundary } from "./city-data";
import { mapPoint } from "./coords";
import { EDUCATION_COLOR, educationRegionKey, educationRegionStyle } from "./education-map";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function addEducationLayers(
  L: typeof Leaflet,
  map: Leaflet.Map,
  education: Education[],
  tripCities: Set<string>,
  boundaries: FeatureCollection | null,
): { layers: Leaflet.Layer[]; focus: Map<string, Leaflet.CircleMarker> } {
  const layers: Leaflet.Layer[] = [];
  const focus = new Map<string, Leaflet.CircleMarker>();
  const groups = new Map<string, Education[]>();
  for (const item of education) {
    const key = educationRegionKey(item) ?? item.location.trim();
    const records = groups.get(key) ?? [];
    records.push(item);
    groups.set(key, records);
  }

  for (const [key, records] of groups) {
    const first = records[0];
    const regionKey = educationRegionKey(first);
    const point = mapPoint(first.latitude, first.longitude, first.city_name === null);
    const popup = `<div style="color:#fff;background:#252320;padding:10px 14px;border-radius:10px;font-family:system-ui;min-width:190px;max-width:280px;">
      <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${escapeHtml(key)} · 求学经历</div>
      ${records.map(item => `<a href="/#education-${encodeURIComponent(item.id)}" style="display:block;color:#fff;text-decoration:none;border-left:2px solid ${EDUCATION_COLOR};padding:5px 8px;margin:5px 0;background:rgba(255,255,255,.05);border-radius:4px;">
        <span style="display:block;font-size:12px;font-weight:600;">${escapeHtml(item.degree)} · ${escapeHtml(item.school)}</span>
        <span style="display:block;color:#aaa;font-size:10px;">${escapeHtml(item.date)} 开始 · 查看卡片 →</span>
      </a>`).join("")}</div>`;

    if (educationRegionStyle(regionKey, tripCities) === "region" && regionKey && boundaries) {
      const feature = matchCityBoundary(regionKey, boundaries);
      if (feature) {
        const region = L.geoJSON(feature, { style: { color: EDUCATION_COLOR, weight: 2, opacity: .8, fillColor: EDUCATION_COLOR, fillOpacity: .12 } }).addTo(map);
        region.bindPopup(popup);
        layers.push(region);
      }
    }

    // A marker remains visible when trips already color the same region.
    const halo = L.circleMarker([point.lat, point.lng], { radius: 14, color: EDUCATION_COLOR, fillColor: EDUCATION_COLOR, weight: 1, opacity: .45, fillOpacity: .12 }).addTo(map);
    const marker = L.circleMarker([point.lat, point.lng], { radius: 7, color: "#fff", fillColor: EDUCATION_COLOR, weight: 1.5, opacity: 1, fillOpacity: .9 }).addTo(map);
    halo.bindPopup(popup);
    marker.bindPopup(popup);
    for (const item of records) focus.set(item.id, marker);
    layers.push(halo, marker);
  }
  return { layers, focus };
}
