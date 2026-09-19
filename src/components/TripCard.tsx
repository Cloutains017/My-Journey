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
    <Link href={`/trip/${trip.slug}`} className="group block relative">
      {/* Timeline dot — desktop only */}
      <div className="hidden md:flex absolute left-[22px] top-9 -translate-x-1/2 z-10">
        <div className="w-2.5 h-2.5 rounded-full bg-hairline border-2 border-canvas group-hover:bg-primary group-hover:scale-125 transition-all duration-300" />
      </div>

      <article className="flex flex-col sm:flex-row gap-0 sm:gap-5 md:gap-7 p-4 sm:p-5 md:pl-14 rounded-xl bg-surface-card border border-hairline-soft group-hover:border-primary/20 transition-colors duration-500">
        <div className="relative w-full h-40 sm:w-[130px] sm:h-[100px] md:w-[170px] md:h-[130px] rounded-lg overflow-hidden flex-shrink-0 bg-surface-cream-strong">
          {trip.cover_image ? (
            <TravelImage src={trip.cover_image} alt={trip.title} fill sizes="(max-width: 639px) calc(100vw - 80px), (max-width: 767px) 130px, 170px" className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
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
            <h3 className="text-lg font-semibold font-display text-ink mb-1.5 truncate group-hover:text-primary transition-colors">
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
            <span className="text-xs text-primary/0 group-hover:text-primary transition-all ml-auto font-medium font-sans">
              查看详情 →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
