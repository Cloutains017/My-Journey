import JourneyLink from "@/components/JourneyLink";
import TravelImage from "@/components/TravelImage";
import { supabase } from "@/lib/supabase";
import type { Trip, Photo, AgreementVote, DesireVote } from "@/lib/types";
import PhotoAlbums from "@/components/PhotoAlbums";
import { groupTripPhotos } from "@/lib/photo-groups";
import AgreementVoteComponent from "@/components/AgreementVote";
import DesireVoteComponent from "@/components/DesireVote";
import VisitorComments from "@/components/VisitorComments";
import RatingBadge from "@/components/RatingBadge";
import ReadingProgress from "@/components/ReadingProgress";
import TripNavigation, { type NavigationTrip } from "@/components/TripNavigation";
import { adjacentTrips } from "@/lib/journey-browsing";
import { notFound } from "next/navigation";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { data: trips } = await supabase.from("trips").select("slug");
  return (trips || []).map((t) => ({ slug: t.slug }));
}

function renderContent(content: string) {
  const blocks = content.split(/\n\n+/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Quote blocks starting with >
    if (trimmed.startsWith(">")) {
      const quoteText = trimmed.replace(/^>\s?/gm, "");
      return (
        <blockquote key={i} className="prose-editorial">
          {quoteText}
        </blockquote>
      );
    }

    return (
      <p key={i}>
        {trimmed}
      </p>
    );
  });
}

export default async function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [{ data: trip }, { data: journeyIndex }] = await Promise.all([
    supabase.from("trips").select("*, photos(*), agreement_votes(*), desire_votes(*)").eq("slug", slug).single(),
    supabase.from("trips").select("id,slug,title,date,location").order("date", { ascending: true }),
  ]);

  if (!trip) notFound();

  const t = trip as Trip & { photos: Photo[]; agreement_votes: AgreementVote[]; desire_votes: DesireVote[] };
  const neighbours = adjacentTrips((journeyIndex ?? []) as NavigationTrip[], t.id);

  return (
    <div>
      <ReadingProgress />

      <header id="trip-top" tabIndex={-1} data-trip-hero className="relative -mt-16 isolate min-h-[100svh] overflow-hidden bg-[#172234] text-white">
        {t.cover_image && (
          <TravelImage src={t.cover_image} alt="" fill sizes="100vw" preload variant="hero" className="-z-10 object-cover object-center" />
        )}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(12,20,31,0.56)_0%,rgba(12,20,31,0.28)_28%,rgba(12,20,31,0.56)_72%,rgba(12,20,31,0.7)_100%)]" aria-hidden="true" />
        <div className="trip-hero-layout">
          <div className="trip-hero-copy">
            {t.location && <p className="trip-hero-reveal trip-hero-location mb-5 text-white/85">{t.location}</p>}
            <h1 className="trip-hero-reveal trip-hero-title break-words" style={{ animationDelay: "80ms" }}>
              {t.title}
            </h1>
            <div className="trip-hero-details">
              <p className="trip-hero-reveal trip-hero-date text-white/90" style={{ animationDelay: "160ms" }}>
                <time dateTime={t.date}>{t.date}</time>
                {t.end_date && t.end_date !== t.date && <> — <time dateTime={t.end_date}>{t.end_date}</time></>}
              </p>
              <div className="trip-hero-reveal trip-hero-rating" style={{ animationDelay: "240ms" }}><RatingBadge rating={t.rating} size="lg" /></div>
            </div>
          </div>
        </div>
        <a href="#trip-content" className="trip-read-cue" aria-label="向下阅读游记">
          <span>向下阅读</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </a>
      </header>

      <article id="trip-content" className="trip-article max-w-3xl mx-auto scroll-mt-24 px-5 py-8 sm:px-8 sm:py-12">
        <div id="trip-reading">
        {/* Back button */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 sm:mb-8">
        <JourneyLink href="/#journey-explorer" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink transition-colors font-sans">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回旅程
        </JourneyLink>
        <JourneyLink href={`/map?trip=${encodeURIComponent(t.id)}`} aria-label={`在地图上查看${t.title}`} className="trip-map-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
          地图定位
        </JourneyLink>
        </div>

        {t.content && (
          <div className="trip-prose mb-10 sm:mb-12">
            {renderContent(t.content)}
          </div>
        )}

        <PhotoAlbums groups={groupTripPhotos(t.photos || [], t.photo_groups)} />
        </div>

        <TripNavigation {...neighbours} />
        <AgreementVoteComponent tripId={t.id} />
        <DesireVoteComponent tripId={t.id} />
        <VisitorComments agreementVotes={t.agreement_votes || []} desireVotes={t.desire_votes || []} />
      </article>
    </div>
  );
}
