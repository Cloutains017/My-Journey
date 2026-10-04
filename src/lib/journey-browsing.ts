export interface JourneySearchRecord {
  id: string;
  kind: "trip" | "education";
  title: string;
  date: string;
  city_name: string | null;
  location: string;
  rating: number | null;
}

export interface JourneyFilters { query: string; rating: string }

export function readJourneyFilters(params: { get(name: string): string | null }): JourneyFilters {
  const rating = params.get("rating") || "";
  return { query: (params.get("q") || "").slice(0, 100), rating: /^[1-5]$/.test(rating) ? rating : "" };
}

export function withJourneyFilters(href: string, params: { get(name: string): string | null }): string {
  const filters = readJourneyFilters(params);
  const [pathAndQuery, hash] = href.split("#", 2);
  const [path, query] = pathAndQuery.split("?", 2);
  const next = new URLSearchParams(query);
  next.delete("year");
  for (const [name, value] of [["q", filters.query], ["rating", filters.rating]]) {
    if (value) next.set(name, value);
  }
  return `${path}${next.size ? `?${next}` : ""}${hash === undefined ? "" : `#${hash}`}`;
}

export function filterJourneys<T extends JourneySearchRecord>(items: T[], filters: JourneyFilters): T[] {
  const words = filters.query.normalize("NFKC").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item => {
    if (filters.rating && (item.kind !== "trip" || String(item.rating) !== filters.rating)) return false;
    const text = [item.title, item.city_name, item.location].join(" ").normalize("NFKC").toLocaleLowerCase();
    return words.every(word => text.includes(word));
  });
}

export function adjacentTrips<T extends { id: string; date: string; kind?: "trip" | "education" }>(items: T[], id: string): { previous: T | null; next: T | null } {
  const trips = items.filter(item => item.kind !== "education").sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const index = trips.findIndex(item => item.id === id);
  return index < 0 ? { previous: null, next: null } : { previous: trips[index - 1] ?? null, next: trips[index + 1] ?? null };
}
