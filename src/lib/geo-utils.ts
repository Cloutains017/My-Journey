import dissolve from "@turf/dissolve";
import { polygon as turfPolygon, featureCollection } from "@turf/helpers";
import type { Feature, Polygon, MultiPolygon } from "geojson";

/**
 * Dissolve a collection of district/area features into a single geometry
 * with internal boundaries removed. Only the outer perimeter is kept.
 * Disjoint areas (islands) are preserved as a MultiPolygon.
 */
export function dissolveDistricts(
  features: Array<{ geometry: Polygon | MultiPolygon }>,
): Polygon["coordinates"] | MultiPolygon["coordinates"] {
  const turfFeatures: Feature<Polygon>[] = [];

  for (const feature of features) {
    const geom = feature.geometry;
    if (!geom) continue;
    const coords =
      geom.type === "Polygon"
        ? [geom.coordinates]
        : geom.type === "MultiPolygon"
          ? geom.coordinates
          : [];
    for (const poly of coords) {
      try {
        turfFeatures.push(turfPolygon(poly));
      } catch {
        /* skip invalid geometries */
      }
    }
  }

  if (turfFeatures.length === 0) return [];
  if (turfFeatures.length === 1) return turfFeatures[0].geometry.coordinates;

  try {
    const dissolved = dissolve(featureCollection(turfFeatures));
    if (dissolved?.features?.length) {
      // Combine all dissolved features (handles disjoint parts like enclaves)
      const allCoords: Polygon["coordinates"][] = [];
      for (const f of dissolved.features) {
        if (f.geometry.type === "Polygon") allCoords.push(f.geometry.coordinates);
      }
      if (allCoords.length === 1) return allCoords[0]; // single Polygon
      return allCoords; // MultiPolygon
    }
  } catch {
    /* dissolve failed — fall back to simple merge */
  }

  // Fallback: simple MultiPolygon concatenation (keeps internal borders)
  const allCoords: Polygon["coordinates"][] = [];
  for (const f of turfFeatures) {
    if (f.geometry.type === "Polygon") allCoords.push(f.geometry.coordinates);
  }
  return allCoords;
}

/** Build a GeoJSON geometry object from dissolved coordinates */
export function buildGeometry(
  coords: Polygon["coordinates"] | MultiPolygon["coordinates"],
): Polygon | MultiPolygon {
  if (coords.length === 0) return { type: "MultiPolygon", coordinates: [] };
  // If first element is a single ring (outer ring of a Polygon)
  if (Array.isArray(coords[0]?.[0]?.[0])) {
    return { type: "MultiPolygon", coordinates: coords as MultiPolygon["coordinates"] };
  }
  return { type: "Polygon", coordinates: coords as Polygon["coordinates"] };
}
