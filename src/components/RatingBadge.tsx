import { RATING_LABELS } from "@/lib/types";

const RATING_STYLES: Record<number, string> = {
  1: "bg-muted/10 text-muted border-muted/20",
  2: "bg-muted/10 text-muted border-muted/20",
  3: "bg-accent-teal/10 text-accent-teal-text border-accent-teal/20",
  4: "bg-accent-amber/10 text-accent-amber-text border-accent-amber/20",
  5: "bg-primary/10 text-primary-text border-primary/20",
};

export default function RatingBadge({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const label = RATING_LABELS[rating] || "?";
  const style = RATING_STYLES[rating] || RATING_STYLES[1];
  const sizeClass = size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-0.5 text-xs";
  return (
    <span className={`inline-block rounded-full border font-semibold ${sizeClass} ${style}`}>
      {label}
    </span>
  );
}
