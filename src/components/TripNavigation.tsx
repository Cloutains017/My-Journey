import JourneyLink from "@/components/JourneyLink";
import type { Trip } from "@/lib/types";

export type NavigationTrip = Pick<Trip, "id" | "slug" | "title" | "date" | "location">;

export default function TripNavigation({ previous, next }: { previous: NavigationTrip | null; next: NavigationTrip | null }) {
  if (!previous && !next) return null;
  return <nav aria-label="相邻旅程" className={`trip-pagination grid gap-3 pb-8 ${previous && next ? "sm:grid-cols-2" : ""}`}>
    {([{ trip: previous, label: "上一篇", arrow: "←" }, { trip: next, label: "下一篇", arrow: "→" }] as const).map(({ trip, label, arrow }) => trip && (
      <JourneyLink key={trip.id} href={`/trip/${encodeURIComponent(trip.slug)}`} rel={label === "上一篇" ? "prev" : "next"} className="trip-pagination-link group">
        <span className="mb-2 flex items-center justify-between gap-3 text-xs text-muted"><span>{label}</span><span aria-hidden="true" className="text-primary">{arrow}</span></span>
        <span className="mb-2 block font-display text-xl leading-snug text-ink transition-colors group-hover:text-primary">{trip.title}</span>
        <span className="block text-xs leading-relaxed text-muted"><time dateTime={trip.date}>{trip.date}</time>{trip.location && ` · ${trip.location}`}</span>
      </JourneyLink>
    ))}
  </nav>;
}
