import { stripCitySuffix } from "./city-data.ts";

export const EDUCATION_COLOR = "#b76e79";
export const RATING_COLORS: Record<number, string> = {
  1: "#6b7280", 2: "#94a3b8", 3: "#66bb6a", 4: "#ffa726", 5: "#ff6b6b",
};

type Place = { city_name: string | null; location: string };
type RatedPlace = Place & { rating: number };

export interface MapRecordGroup<T, E> {
  trips: T[];
  education: E[];
  domestic: boolean;
  color: string;
}

/** Each city appears once on the map. Education never contributes to its trip rating. */
export function groupMapRecords<T extends RatedPlace, E extends Place>(
  trips: T[],
  education: E[],
): Map<string, MapRecordGroup<T, E>> {
  const groups = new Map<string, MapRecordGroup<T, E>>();
  function add(record: Place, kind: "trip" | "education") {
    const key = stripCitySuffix(record.city_name?.trim() || record.location);
    let group = groups.get(key);
    if (!group) {
      group = { trips: [], education: [], domestic: record.city_name !== null, color: EDUCATION_COLOR };
      groups.set(key, group);
    }
    if (record.city_name !== null) group.domestic = true;
    if (kind === "trip") group.trips.push(record as T);
    else group.education.push(record as E);
  }
  for (const trip of trips) add(trip, "trip");
  for (const item of education) add(item, "education");
  for (const group of groups.values()) {
    if (group.trips.length) {
      const average = Math.round(group.trips.reduce((sum, trip) => sum + trip.rating, 0) / group.trips.length);
      group.color = RATING_COLORS[average] ?? RATING_COLORS[5];
    }
  }
  return groups;
}
