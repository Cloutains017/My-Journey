import Link from "next/link";
import type { Trip } from "@/lib/types";
import { formatDateRange } from "@/lib/types";
import TravelImage from "@/components/TravelImage";
import RatingBadge from "@/components/RatingBadge";

const PinIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block text-muted-soft -mt-px">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export default function TripCard({ trip, photoCount }: { trip: Trip; photoCount: number }) {

  return (
    <Link href={`/trip/${trip.slug}`} className="group block relative rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      <article className="flex flex-col sm:flex-row gap-0 sm:gap-6 py-5 border-b border-hairline-soft group-hover:border-primary/40 transition-colors duration-300">
        <div className="relative w-full aspect-[16/10] sm:aspect-auto sm:w-[180px] sm:h-[140px] rounded-lg overflow-hidden flex-shrink-0 bg-surface-cream-strong">
          {trip.cover_image ? (
            <TravelImage src={trip.cover_image} alt={trip.title} fill sizes="(max-width: 639px) calc(100vw - 48px), 180px" className="object-cover motion-safe:group-hover:scale-105 transition-transform duration-500 ease-out" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-surface-cream-strong text-2xl">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 22h20L12 2z" opacity="0.3" /></svg>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        </div>
        <div className="flex flex-col justify-between flex-1 min-w-0 pt-3 sm:pt-0">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-xs text-muted font-sans">{formatDateRange(trip.date, trip.end_date)}</span>
              <RatingBadge rating={trip.rating} />
            </div>
            <h3 className="text-xl font-normal font-display text-ink mb-2 break-words group-hover:text-primary transition-colors">
              {trip.title}
            </h3>
            {trip.location && (
              <p className="text-xs text-muted-soft mb-1.5 flex items-center gap-1 font-sans">
                <PinIcon /> {trip.location}
              </p>
            )}
            <p className="text-sm text-body leading-relaxed line-clamp-2 font-sans">
              {trip.content?.replace(/[#*`>]/g, "").slice(0, 120) || "暂无文字记录"}
            </p>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <p className="text-xs text-muted-soft font-sans">{photoCount} 张照片</p>
            <span className="text-xs text-primary ml-auto font-medium font-sans">
              查看详情 →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
