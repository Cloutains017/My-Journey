import Link from "next/link";
import type { Education } from "@/lib/types";

export default function EducationCard({ education }: { education: Education }) {
  return (
    <Link href={`/map?education=${encodeURIComponent(education.id)}`} id={`education-${education.id}`}
      className="education-card group block scroll-mt-32 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8A5AB4]"
      aria-label={`在地图上查看${education.school}`}>
      <article className="flex items-center gap-5 border-b border-hairline-soft py-7 transition-colors duration-300 group-hover:border-[#8A5AB4]/60">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#8A5AB4]/8 text-[#8A5AB4]">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m2 8 10-5 10 5-10 5L2 8Zm4 2v6c4 3 8 3 12 0v-6M22 8v8" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-2 font-sans text-xs text-muted tabular-nums">{education.date} 开始</p>
          <h3 className="mb-1 break-words font-display text-xl text-ink transition-colors group-hover:text-[#8A5AB4]">{education.degree}</h3>
          <p className="font-sans text-sm text-body">{education.school}</p>
          <p className="mt-2 font-sans text-xs text-muted">{education.location} · {education.city_name === null ? "境外" : "中国境内"}</p>
        </div>
        <span className="hidden font-sans text-xs text-[#8A5AB4] sm:block">地图定位 →</span>
      </article>
    </Link>
  );
}
