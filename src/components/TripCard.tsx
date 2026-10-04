import JourneyLink from "@/components/JourneyLink";
import type { Trip } from "@/lib/types";
import { formatDateRange } from "@/lib/types";
import TravelImage from "@/components/TravelImage";
import RatingBadge from "@/components/RatingBadge";
import type { ReactNode } from "react";
import { getTripExcerpt, coverObjectPosition } from "@/lib/trip-presentation";

const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export default function TripCard({ trip, photoCount, preview = false, media }: { trip: Trip; photoCount: number; preview?: boolean; media?: ReactNode }) {

  const content = (
      <article className="trip-card-layout">
        <div className="trip-card-media relative overflow-hidden bg-surface-cream-strong">
          {media ?? (trip.cover_image ? (
            <TravelImage src={trip.cover_image} alt={trip.title} fill sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) 40vw, 420px" loading="lazy" className="trip-card-image object-cover" style={{ objectPosition: coverObjectPosition(trip.cover_card_position) }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-surface-cream-strong text-2xl">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 22h20L12 2z" opacity="0.3" /></svg>
            </div>
          ))}
        </div>
        <div className="trip-card-copy">
          <div>
            <h3 className="trip-card-title text-ink break-words transition-colors">
              {trip.title}
            </h3>
            {trip.location && (
              <p className="trip-card-location text-muted flex items-start gap-1.5">
                <PinIcon /> <span className="line-clamp-2">{trip.location}</span>
              </p>
            )}
            <p className="trip-card-excerpt text-body line-clamp-2">
              {getTripExcerpt(trip)}
            </p>
          </div>
          <div className="trip-card-meta">
            <span className="text-muted tabular-nums">{formatDateRange(trip.date, trip.end_date).replace(" → ", " — ")}</span>
            <RatingBadge rating={trip.rating} />
          </div>
          <div className="trip-card-footer">
            <span className="text-muted">{photoCount} 张照片</span>
            <span className="trip-card-read text-ink">
              阅读游记
            </span>
          </div>
        </div>
      </article>
  );
  if (preview) return <div className="trip-card group block relative rounded-lg">{content}</div>;
  return <JourneyLink href={`/trip/${trip.slug}`} className="trip-card group block relative rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{content}</JourneyLink>;
}
