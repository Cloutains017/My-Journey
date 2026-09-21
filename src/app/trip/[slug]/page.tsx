import Link from "next/link";
import TravelImage from "@/components/TravelImage";
import { supabase } from "@/lib/supabase";
import type { Trip, Photo, AgreementVote, DesireVote } from "@/lib/types";
import { formatDateRange } from "@/lib/types";
import PhotoGallery from "@/components/PhotoGallery";
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

      {/* Cover hero - magazine style */}
      <div className="relative w-full h-[50vh] min-h-[400px] overflow-hidden">
        {t.cover_image ? (
          <TravelImage src={t.cover_image} alt={t.title} fill sizes="100vw" preload className="object-cover scale-105" />
        ) : (
          <div className="w-full h-full bg-surface-cream-strong flex items-center justify-center">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-surface-cream-strong">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-canvas via-canvas/90 via-30% to-transparent" />

        {/* Title overlay on cover */}
        <div className="absolute bottom-8 left-0 right-0 max-w-3xl mx-auto px-8 z-10">
          <p className="w-fit max-w-full rounded-lg bg-black/75 px-3 py-2 text-base md:text-lg font-medium leading-relaxed text-white mb-3 font-sans">
            {formatDateRange(t.date, t.end_date)} · {t.location}
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-normal tracking-[-0.5px] text-on-dark drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)]">
            {t.title}
          </h1>
          <div className="mt-3">
            <RatingBadge rating={t.rating} size="lg" />
          </div>
        </div>
      </div>

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

        <PhotoGallery photos={t.photos || []} />

        <AgreementVoteComponent tripId={t.id} />
        <DesireVoteComponent tripId={t.id} />
        <VisitorComments agreementVotes={t.agreement_votes || []} desireVotes={t.desire_votes || []} />
      </article>
    </div>
  );
}
