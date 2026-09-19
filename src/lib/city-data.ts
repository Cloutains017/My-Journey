// ---------------------------------------------------------------------------
// Minimal GeoJSON types (no external dependency needed)
// ---------------------------------------------------------------------------
import type { Feature, Polygon, MultiPolygon } from "geojson";

export type GeoJSONFeature = Feature<Polygon | MultiPolygon, Record<string, unknown>>;

export interface FeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// ---------------------------------------------------------------------------
// City matching utilities
// ---------------------------------------------------------------------------

/**
 * Strip administrative suffixes from a Chinese city name.
 * "阿坝藏族羌族自治州" → "阿坝"
 * "神农架林区" → "神农架"
 * "杭州市" → "杭州"
 */
export function stripCitySuffix(name: string): string {
  return name
    .replace(/土家族苗族自治州$/, "")
    .replace(/蒙古族藏族自治州$/, "")
    .replace(/藏族羌族自治州$/, "")
    .replace(/哈萨克族自治州$/, "")
    .replace(/柯尔克孜自治州$/, "")
    .replace(/哈尼族自治州$/, "")
    .replace(/朝鲜族自治州$/, "")
    .replace(/蒙古族自治州$/, "")
    .replace(/白族自治州$/, "")
    .replace(/彝族自治州$/, "")
    .replace(/藏族自治州$/, "")
    .replace(/苗族自治州$/, "")
    .replace(/回族自治州$/, "")
    .replace(/壮族自治州$/, "")
    .replace(/傣族自治州$/, "")
    .replace(/蒙古自治州$/, "")
    .replace(/自治州$/, "")
    .replace(/自治县$/, "")
    .replace(/市$/, "")
    .replace(/地区$/, "")
    .replace(/盟$/, "")
    .replace(/林区$/, "")
    .replace(/省$/, "");
}

/**
 * Match a trip location to a city boundary GeoJSON feature.
 * Tries exact match, then strips suffixes progressively.
 */
export function matchCityBoundary(
  cityNameOrLocation: string,
  geoJSON: FeatureCollection,
): GeoJSONFeature | null {
  // Try exact match
  let feature = geoJSON.features.find(
    (f) => f.properties?.name === cityNameOrLocation,
  );
  if (feature) return feature;

  // Try with suffixes stripped
  const stripped = stripCitySuffix(cityNameOrLocation);
  if (stripped !== cityNameOrLocation) {
    feature = geoJSON.features.find(
      (f) => f.properties?.name === stripped,
    );
    if (feature) return feature;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Highlighted pin locations (always shown on map, independent of trip data)
// Coordinates in WGS-84, converted to GCJ-02 at render time for Gaode tiles
// ---------------------------------------------------------------------------
export interface PinLocation {
  name: string;
  label?: string; // display text in popup, falls back to name
  lat: number; // WGS-84
  lng: number; // WGS-84
}

export const PIN_LOCATIONS: PinLocation[] = [
  { name: "厦门", label: "厦门·家", lat: 24.4798, lng: 118.0894 },
  { name: "福州", label: "福州·福州大学", lat: 26.0745, lng: 119.2965 },
  { name: "新加坡", label: "新加坡·南洋理工大学", lat: 1.3521, lng: 103.8198 },
];

