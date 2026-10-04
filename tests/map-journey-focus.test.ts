import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";
import type { Trip, Education } from "../src/lib/types.ts";

const require = createRequire(import.meta.url);
class Layer {
  handlers = new Map<string, () => void>();
  opened = false;
  popup = "";
  style: Record<string, unknown> = {};
  point?: number[];
  bounds?: string;
  constructor(point?: number[], bounds?: string) { this.point = point; this.bounds = bounds; }
  addTo() { return this; }
  bindPopup(content: string) { this.popup = content; return this; }
  on(event: string, callback: () => void) { this.handlers.set(event, callback); return this; }
  setStyle(style: Record<string, unknown>) { Object.assign(this.style, style); return this; }
  setRadius(radius: number) { this.style.radius = radius; return this; }
  getBounds() { return this.bounds; }
  getLatLng() { return this.point; }
  isPopupOpen() { return this.opened; }
  openPopup() { this.opened = true; this.handlers.get("popupopen")?.(); return this; }
}

async function draw(trips: Trip[], education: Education[] = [], boundaries: unknown = null, filters = new URLSearchParams()) {
  const source = await readFile("src/lib/map-journey-layers.ts", "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} as { addJourneyLayers(...args: unknown[]): { layers: Layer[]; focus: Map<string, () => void> } } };
  new Function("require", "module", "exports", compiled)((id: string) => require(`../src/lib/${id.slice(2)}.ts`), compiledModule, compiledModule.exports);
  const moves: Array<{ type: string; target: unknown; options: unknown }> = [];
  const map = {
    once() {}, getZoom: () => 9,
    flyToBounds: (target: unknown, options: unknown) => moves.push({ type: "flyBounds", target, options }),
    flyTo: (target: unknown, options: unknown) => moves.push({ type: "fly", target, options }),
    fitBounds: (target: unknown, options: unknown) => moves.push({ type: "bounds", target, options }),
    setView: (target: unknown, zoom: number, options: unknown) => moves.push({ type: "point", target: { point: target, zoom }, options }),
  };
  const leaflet = {
    geoJSON: (feature: { properties: { name: string } }) => new Layer(undefined, feature.properties.name),
    circleMarker: (point: number[]) => new Layer(point),
  };
  return { ...compiledModule.exports.addJourneyLayers(leaflet, map, trips, education, boundaries, filters), moves };
}
const trip = { id: "trip-fuzhou", title: "山水", slug: "mountains", city_name: "福州市", location: "福建省福州市", latitude: 26.08, longitude: 119.3, rating: 5, date: "2026-01-01", end_date: null } as Trip;
const school = { ...trip, id: "school-fuzhou", degree: "本科", school: "福州大学" } as unknown as Education;
const boundary = { type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "福州市" }, geometry: { type: "Polygon", coordinates: [] } }] };

test("trip and school focus share their city bounds and open details without waiting for movement", async () => {
  const view = await draw([trip], [school], boundary);
  assert.ok(view.focus.has(trip.id), "each trip needs its own map focus entry");
  view.focus.get(trip.id)!();
  const region = view.layers[1];
  assert.equal(region.opened, true);
  assert.equal(region.style.fillOpacity, .25);
  assert.equal(view.moves[0].target, "福州市");
  view.focus.get(school.id)!();
  assert.equal(region.opened, true);
  assert.equal(view.moves[1].target, "福州市");
});

test("missing city boundaries retain a focusable coordinate marker", async () => {
  const view = await draw([trip]);
  assert.ok(view.focus.has(trip.id));
  assert.equal(view.layers.length, 2);
  view.focus.get(trip.id)!();
  assert.equal(view.layers[1].opened, true);
  assert.equal(view.moves[0].type, "point");
});

test("overseas focus uses the trip coordinates and keeps popup titles escaped", async () => {
  const abroad = { ...trip, id: "trip-singapore", city_name: null, location: "新加坡", title: '<script>alert("x")</script>', latitude: 1.3, longitude: 103.8 };
  const view = await draw([abroad]);
  assert.ok(view.focus.has(abroad.id));
  view.focus.get(abroad.id)!();
  assert.deepEqual(view.moves[0].target, { point: [1.3, 103.8], zoom: 9 });
  assert.equal(view.layers[1].opened, true);
  assert.ok(view.layers[1].popup.includes("&lt;script&gt;"));
  assert.ok(!view.layers[1].popup.includes("<script>"));
});

test("map popup trip links keep the search context and escape query separators", async () => {
  const view = await draw([trip], [], null, new URLSearchParams("q=山水&year=2026&rating=5"));
  assert.ok(view.layers[1].popup.includes('href="/trip/mountains?q=%E5%B1%B1%E6%B0%B4&amp;rating=5"'));
});
