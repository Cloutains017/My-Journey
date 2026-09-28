import { stripCitySuffix } from "./city-data.ts";

export const EDUCATION_COLOR = "#b76e79";

export function educationRegionKey(education: { city_name: string | null; location: string }): string | null {
  return education.city_name === null ? null : stripCitySuffix(education.city_name.trim() || education.location);
}

export function educationRegionStyle(key: string | null, tripCities: Set<string>): "region" | "marker" {
  return key && !tripCities.has(key) ? "region" : "marker";
}
