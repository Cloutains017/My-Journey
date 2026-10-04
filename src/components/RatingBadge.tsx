import { RATING_LABELS, RATING_DESCRIPTIONS } from "@/lib/types";

const RATING_STYLES: Record<number, string> = {
  1: "bg-hairline text-muted border-hairline",
  2: "bg-hairline text-muted border-hairline",
  3: "bg-accent-teal/10 text-accent-teal-text border-accent-teal/20",
  4: "bg-accent-amber/10 text-accent-amber-text border-accent-amber/20",
  5: "bg-primary/10 text-primary-text border-primary/20",
};

export default function RatingBadge({ rating, size = "sm", explain = false }: { rating: number; size?: "sm" | "lg"; explain?: boolean }) {
  const label = RATING_LABELS[rating] || "?";
  const style = RATING_STYLES[rating] || RATING_STYLES[1];
  const sizeClass = size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <><span title={RATING_DESCRIPTIONS[rating]} className={`inline-block rounded-full border font-semibold ${sizeClass} ${style}`}>
      {label}
    </span>{explain && <small className="rating-explanation">{RATING_DESCRIPTIONS[rating]}</small>}</>
  );
}
