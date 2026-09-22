import Link from "next/link";
import TravelImage from "@/components/TravelImage";
import { supabase } from "@/lib/supabase";
import type { Trip, Photo, AgreementVote, DesireVote } from "@/lib/types";
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
      <div className="relative isolate flex min-h-[400px] w-full flex-col justify-end overflow-hidden md:min-h-[50vh]">
        {t.cover_image ? (
          <TravelImage src={t.cover_image} alt={t.title} fill sizes="100vw" preload className="object-cover scale-105" />
        ) : (
          <div className="absolute inset-0 bg-surface-cream-strong flex items-center justify-center">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-surface-cream-strong">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
        {/* Fade into the page canvas before the text, keeping metadata clear on any cover. */}
        <header className="relative z-10 mt-36 bg-[linear-gradient(to_bottom,transparent,var(--color-canvas)_6rem)] pt-28 pb-8">
          <div className="max-w-3xl mx-auto px-8">
            <div className="mb-4 flex flex-col gap-1 text-sm leading-relaxed text-muted font-sans sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
              <span className="tabular-nums">
                <time dateTime={t.date}>{t.date}</time>
                {t.end_date && t.end_date !== t.date && <> — <time dateTime={t.end_date}>{t.end_date}</time></>}
              </span>
              {t.location && <>
                <span className="hidden h-3 w-px bg-hairline sm:block" aria-hidden="true" />
                <span className="text-body">{t.location}</span>
              </>}
            </div>
            <h1 className="trip-title font-display font-normal text-ink break-words">
              {t.title}
            </h1>
            <div className="mt-3">
              <RatingBadge rating={t.rating} size="lg" />
            </div>
          </div>
        </header>
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
