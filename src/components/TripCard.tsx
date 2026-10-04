import JourneyLink from "@/components/JourneyLink";
import type { Trip } from "@/lib/types";
import { formatDateRange } from "@/lib/types";
import TravelImage from "@/components/TravelImage";
import RatingBadge from "@/components/RatingBadge";

const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export default function TripCard({ trip, photoCount }: { trip: Trip; photoCount: number }) {

  return (
    <JourneyLink href={`/trip/${trip.slug}`} className="trip-card group block relative rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      <article className="flex flex-col sm:flex-row gap-0 sm:gap-6 py-5 sm:py-6 border-b border-hairline-soft group-hover:border-primary/40 transition-colors duration-300">
        <div className="trip-card-media relative w-full aspect-[16/9] sm:aspect-auto sm:w-[180px] sm:h-[140px] rounded-xl sm:rounded-lg overflow-hidden flex-shrink-0 bg-surface-cream-strong">
          {trip.cover_image ? (
            <TravelImage src={trip.cover_image} alt={trip.title} fill sizes="(max-width: 639px) calc(100vw - 40px), 180px" loading="lazy" className="object-cover motion-safe:group-hover:scale-[1.03] transition-[opacity,transform] duration-500 ease-out" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-surface-cream-strong text-2xl">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 22h20L12 2z" opacity="0.3" /></svg>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>
        <div className="flex flex-col justify-between flex-1 min-w-0 pt-4 sm:pt-0">
          <div>
            <div className="trip-card-meta flex flex-wrap items-center gap-x-3 gap-y-2 mb-2.5">
              <span className="text-muted tabular-nums">{formatDateRange(trip.date, trip.end_date).replace(" → ", " — ")}</span>
              <RatingBadge rating={trip.rating} />
            </div>
            <h3 className="trip-card-title text-ink mb-2 break-words group-hover:text-primary transition-colors">
              {trip.title}
            </h3>
            {trip.location && (
              <p className="trip-card-location text-muted mb-2.5 flex items-start gap-1.5">
                <PinIcon /> <span className="line-clamp-2">{trip.location}</span>
              </p>
            )}
            <p className="trip-card-excerpt text-body line-clamp-2">
              {trip.content?.replace(/[#*`>]/g, "").slice(0, 120) || "暂无文字记录"}
            </p>
          </div>
          <div className="trip-card-footer flex items-center gap-4 mt-4">
            <p className="text-muted">{photoCount} 张照片</p>
            <span className="inline-flex items-center gap-2 text-primary ml-auto font-medium">
              阅读游记 <span aria-hidden="true" className="motion-safe:group-hover:translate-x-1 transition-transform">→</span>
            </span>
          </div>
        </div>
      </article>
    </JourneyLink>
  );
}
