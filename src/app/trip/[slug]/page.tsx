import Link from "next/link";
import TravelImage from "@/components/TravelImage";
import { supabase } from "@/lib/supabase";
import type { Trip, Photo, AgreementVote, DesireVote } from "@/lib/types";
import PhotoGallery from "@/components/PhotoGallery";
import { groupTripPhotos } from "@/lib/photo-groups";
import AgreementVoteComponent from "@/components/AgreementVote";
import DesireVoteComponent from "@/components/DesireVote";
import VisitorComments from "@/components/VisitorComments";
import RatingBadge from "@/components/RatingBadge";
import ReadingProgress from "@/components/ReadingProgress";
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

    // First paragraph gets drop-cap
    if (i === 0) {
      return (
        <p key={i} className="drop-cap text-base text-body leading-relaxed font-sans">
          {trimmed}
        </p>
      );
    }

    return (
      <p key={i} className="text-base text-body leading-relaxed font-sans">
        {trimmed}
      </p>
    );
  });
}

export default async function TripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: trip } = await supabase
    .from("trips")
    .select("*, photos(*), agreement_votes(*), desire_votes(*)")
    .eq("slug", slug)
    .single();

  if (!trip) notFound();

  const t = trip as Trip & { photos: Photo[]; agreement_votes: AgreementVote[]; desire_votes: DesireVote[] };

  return (
    <div>
      <ReadingProgress />

      <header data-trip-hero className="relative -mt-16 isolate min-h-[100svh] overflow-hidden bg-[#172234] text-white">
        {t.cover_image && (
          <TravelImage src={t.cover_image} alt="" fill sizes="100vw" preload unoptimized className="-z-10 object-cover object-center" />
        )}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(12,20,31,0.56)_0%,rgba(12,20,31,0.28)_28%,rgba(12,20,31,0.56)_72%,rgba(12,20,31,0.7)_100%)]" aria-hidden="true" />
        <div className="flex min-h-[100svh] flex-col items-center justify-center px-6 pb-16 pt-24 text-center">
          {t.location && <p className="mb-6 text-xs font-medium tracking-[0.28em] text-white/85 sm:text-sm">{t.location}</p>}
          <h1 className="trip-hero-title max-w-5xl break-words font-display text-[clamp(3rem,7vw,6rem)] leading-[1.12] font-normal tracking-[0.04em] text-balance drop-shadow-lg">
            {t.title}
          </h1>
          <p className="mt-7 text-sm font-medium tracking-[0.2em] text-white/90">
            <time dateTime={t.date}>{t.date}</time>
            {t.end_date && t.end_date !== t.date && <> — <time dateTime={t.end_date}>{t.end_date}</time></>}
          </p>
          <div className="trip-hero-rating mt-8"><RatingBadge rating={t.rating} size="lg" /></div>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-8 py-10">
        {/* Back button */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors mb-8 font-sans">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回旅程
        </Link>

        {t.content && (
          <div className="space-y-4 mb-12">
            {renderContent(t.content)}
          </div>
        )}

        {groupTripPhotos(t.photos || [], t.photo_groups).map(group => (
          <PhotoGallery key={group.id} title={group.title} photos={group.photos} />
        ))}

        <AgreementVoteComponent tripId={t.id} />
        <DesireVoteComponent tripId={t.id} />
        <VisitorComments agreementVotes={t.agreement_votes || []} desireVotes={t.desire_votes || []} />
      </article>
    </div>
  );
}
