import type * as Leaflet from "leaflet";
import type { Trip, Education } from "./types";
import { formatDateRange } from "./types";
import type { FeatureCollection } from "./city-data";
import { getCityDisplayName, matchCityBoundary } from "./city-data";
import { mapPoint } from "./coords";
import { EDUCATION_COLOR, RATING_COLORS, groupMapRecords } from "./education-map";
import { withJourneyFilters } from "./journey-browsing";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function popupContent(name: string, trips: Trip[], education: Education[], filters: { get(name: string): string | null }): string {
  const rows = [
    ...trips.map(trip => ({ date: trip.date, html: `
      <div class="journey-popup-card" style="--journey-accent:${RATING_COLORS[trip.rating] ?? RATING_COLORS[5]}">
        <a class="journey-popup-card__main" href="${escapeHtml(withJourneyFilters(`/trip/${encodeURIComponent(trip.slug)}`, filters))}" title="查看旅程详情">
          <span class="journey-popup-card__title">${escapeHtml(trip.title)}</span>
          <span class="journey-popup-card__date">${escapeHtml(formatDateRange(trip.date, trip.end_date))}</span>
        </a>
        <a class="journey-popup-card__action" href="/#year-${escapeHtml(trip.date.slice(0, 4))}" title="在时间轴上定位">定位 <span aria-hidden="true">↗</span></a>
      </div>` })),
    ...education.map(item => ({ date: item.date, html: `
      <a class="journey-popup-card" style="--journey-accent:${EDUCATION_COLOR}" href="/#education-${escapeHtml(encodeURIComponent(item.id))}" title="查看求学足迹">
        <span class="journey-popup-card__main">
          <span class="journey-popup-card__title">${escapeHtml(item.degree)} · ${escapeHtml(item.school)}</span>
          <span class="journey-popup-card__date">${escapeHtml(item.date)} 开始</span>
        </span>
        <span class="journey-popup-card__action" aria-hidden="true">查看 <span>↗</span></span>
      </a>` })),
  ];
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="journey-popup">
    <div class="journey-popup__header">
      <span class="journey-popup__eyebrow">足迹 · ${rows.length} 条记录</span>
      <strong class="journey-popup__title">${escapeHtml(name)}</strong>
    </div>
    <div class="journey-popup__list">${rows.map(row => row.html).join("")}</div>
  </div>`;
}

/** Draw one interactive shape and one popup for each city, including its schools. */
export function addJourneyLayers(
  L: typeof Leaflet,
  map: Leaflet.Map,
  trips: Trip[],
  education: Education[],
  boundaries: FeatureCollection | null,
  filters: { get(name: string): string | null } = new URLSearchParams(),
): { layers: Leaflet.Layer[]; focus: Map<string, () => void> } {
  const layers: Leaflet.Layer[] = [];
  const focus = new Map<string, () => void>();

  for (const [key, group] of groupMapRecords(trips, education)) {
    const c = group.color;
    const name = getCityDisplayName(key, [...group.trips, ...group.education]);
    const popup = popupContent(name, group.trips, group.education, filters);
    const feature = group.domestic && boundaries ? matchCityBoundary(key, boundaries) : null;

    if (feature) {
      const glow = L.geoJSON(feature, { style: { color: c, weight: 8, opacity: .15, fillColor: "transparent", fillOpacity: 0 } }).addTo(map);
      const region = L.geoJSON(feature, { style: { color: c, weight: 2, opacity: .8, fillColor: c, fillOpacity: .1 } }).addTo(map);
      region.bindPopup(popup, { className: "journey-map-popup", maxWidth: 320 });
      const highlight = () => {
        region.setStyle({ fillOpacity: .25, opacity: 1, weight: 3 });
        glow.setStyle({ opacity: .35, weight: 14 });
      };
      const reset = () => {
        region.setStyle({ color: c, weight: 2, opacity: .8, fillColor: c, fillOpacity: .1 });
        glow.setStyle({ color: c, weight: 8, opacity: .15, fillColor: "transparent", fillOpacity: 0 });
      };
      region.on("mouseover", highlight);
      region.on("mouseout", () => { if (!region.isPopupOpen()) reset(); });
      region.on("popupopen", highlight);
      region.on("popupclose", reset);
      for (const item of [...group.trips, ...group.education]) {
        focus.set(item.id, () => {
          map.fitBounds(region.getBounds(), { maxZoom: 8, padding: [24, 24], animate: false });
          region.openPopup();
        });
      }
      layers.push(glow, region);
      continue;
    }

    // A coordinate marker also keeps domestic records usable if a boundary is unavailable.
    const first = group.trips[0] ?? group.education[0];
    const point = mapPoint(first.latitude, first.longitude, !group.domestic);
    const halo = L.circleMarker([point.lat, point.lng], { radius: 14, fillColor: c, color: c, weight: 1.5, opacity: .35, fillOpacity: .12 }).addTo(map);
    const marker = L.circleMarker([point.lat, point.lng], { radius: 7, fillColor: c, color: c, weight: 2, opacity: .9, fillOpacity: .45 }).addTo(map);
    halo.bindPopup(popup, { className: "journey-map-popup", maxWidth: 320 });
    marker.bindPopup(popup, { className: "journey-map-popup", maxWidth: 320 });
    marker.on("mouseover", () => { halo.setRadius(22); halo.setStyle({ opacity: .6, weight: 2 }); });
    marker.on("mouseout", () => { if (!marker.isPopupOpen()) { halo.setRadius(14); halo.setStyle({ opacity: .35, weight: 1.5 }); } });
    marker.on("popupopen", () => { halo.setRadius(22); halo.setStyle({ opacity: .6, weight: 2 }); });
    marker.on("popupclose", () => { halo.setRadius(14); halo.setStyle({ opacity: .35, weight: 1.5 }); });
    for (const item of [...group.trips, ...group.education]) {
      focus.set(item.id, () => {
        map.setView(marker.getLatLng(), 9, { animate: false });
        marker.openPopup();
      });
    }
    layers.push(halo, marker);
  }
  return { layers, focus };
}
