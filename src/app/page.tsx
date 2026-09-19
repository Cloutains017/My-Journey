import { supabase } from "@/lib/supabase";
import HeroMap from "@/components/HeroMap";
import TripCard from "@/components/TripCard";
import MilestoneMarker from "@/components/MilestoneMarker";
import YearNav from "@/components/YearNav";
import type { Trip, Milestone } from "@/lib/types";

export const revalidate = 3600;

const MILESTONES: Milestone[] = [
  { id: "ms-2010", title: "第一天背起书包", subtitle: "厦门市同安区第一实验小学", date: "2010-09-01", icon: "school" },
  { id: "ms-2016", title: "东山下的少年时代", subtitle: "厦门市东山中学", date: "2016-09-01", icon: "middle" },
  { id: "ms-2019", title: "青春正好的三年", subtitle: "厦门外国语学校", date: "2019-09-01", icon: "high" },
  { id: "ms-2022", title: "旗山脚下的四年", subtitle: "福州大学", date: "2022-09-01", icon: "uni", stage: "大学 · 本科" },
  { id: "ms-2026", title: "从旗山到狮城", subtitle: "南洋理工大学", date: "2026-08-01", icon: "uni", stage: "大学 · 硕士研究生" },
];

type TimelineItem =
  | { kind: "trip"; data: Trip & { photo_count: number } }
  | { kind: "milestone"; data: Milestone };

export default async function HomePage() {
  const { data: trips, error } = await supabase
    .from("trips")
    .select("*, photos(count)")
    .order("date", { ascending: false });

  if (error) throw new Error("暂时无法加载旅程，请稍后重试");
  const tripList = (trips || []).map((row) => {
    const { photos, ...trip } = row as Omit<Trip, "photos"> & { photos: { count: number }[] };
    return { ...trip, photo_count: photos[0]?.count ?? 0 };
  });

  // Merge trips + milestones into unified timeline
  const items: TimelineItem[] = [
    ...tripList.map((t) => ({ kind: "trip" as const, data: t })),
    ...MILESTONES.map((m) => ({ kind: "milestone" as const, data: m })),
  ];
  items.sort((a, b) => b.data.date.localeCompare(a.data.date));

  // Group by year
  const yearGroups = new Map<number, TimelineItem[]>();
  for (const item of items) {
    const y = Number(item.data.date.slice(0, 4));
    const list = yearGroups.get(y);
    if (list) list.push(item);
    else yearGroups.set(y, [item]);
  }
  const sortedYears = Array.from(yearGroups.keys()).sort((a, b) => b - a);

  const cityCount = new Set(tripList.map((t) => t.city_name || t.location).filter(Boolean)).size;
  const latestDate = tripList[0]?.date || "—";

  return (
    <div>
      <HeroMap trips={tripList} />

      {/* Info section — below map */}
      <div className="bg-canvas border-b border-hairline">
        <div className="max-w-3xl mx-auto px-6 sm:px-8 py-12 sm:py-16 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8 sm:gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[4px] text-muted-soft mb-2 font-medium font-sans">
              Where I&apos;ve Been
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-[-0.5px] text-ink">
              Cloutains <span className="text-muted-soft font-light">的旅程</span>
            </h1>
            <p className="text-xs text-muted mt-1.5 tracking-wider font-sans">
              用脚步丈量世界
            </p>
          </div>

          <div className="flex items-end gap-5 sm:gap-7">
            <div className="flex flex-col">
              <span className="font-display text-3xl sm:text-4xl text-ink tabular-nums tracking-[-0.5px]">{tripList.length}</span>
              <span className="text-[11px] text-muted-soft mt-0.5 font-sans tracking-wide">段旅程</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-3xl sm:text-4xl text-primary tabular-nums tracking-[-0.5px]">{cityCount || "—"}</span>
              <span className="text-[11px] text-muted-soft mt-0.5 font-sans tracking-wide">座城市</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-2xl sm:text-3xl text-ink tabular-nums tracking-[-0.5px]">{latestDate || "—"}</span>
              <span className="text-[11px] text-muted-soft mt-0.5 font-sans tracking-wide">最近记录</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline section */}
      <section className="max-w-3xl mx-auto px-6 sm:px-8 pt-16 pb-24">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[5px] text-muted-soft mb-6 font-medium font-sans">
            旅 · 程 · 时 · 间 · 线
          </p>
          <h2 className="font-display text-5xl sm:text-6xl font-normal tracking-[-1px] text-ink mb-5">
            来日方长
          </h2>
          <p className="text-sm sm:text-base text-muted leading-relaxed font-sans">
            走过的已成风景，未至的才是远方
          </p>
        </div>

        {/* Year navigation sidebar */}
        <YearNav years={sortedYears} />

        <div className="relative">
          {/* Vertical timeline line */}
          <div
            className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-hairline via-hairline-soft to-transparent hidden md:block"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, var(--color-hairline-soft) 0px, var(--color-hairline-soft) 4px, transparent 4px, transparent 12px)",
            }}
          />

          <div className="flex flex-col gap-10">
            {sortedYears.map((year, yi) => {
              const yearItems = yearGroups.get(year)!;

              return (
                <div key={year} id={`year-${year}`} className="scroll-mt-24">
                  {/* Year divider */}
                  <div className="flex items-center gap-4 mb-10 md:ml-14">
                    <div className="hidden md:block w-3 h-3 rounded-full bg-primary ring-4 ring-canvas flex-shrink-0" />
                    <span className="font-display text-6xl font-normal text-primary tracking-[-1px] select-none leading-none tabular-nums">
                      {year}
                    </span>
                    <span className="font-display text-xl font-normal text-primary/30 select-none leading-none mt-1">年</span>
                    <div className="flex-1 h-px ml-2 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent" />
                  </div>

                  <div className="flex flex-col gap-6">
                    {yearItems.map((item, index) =>
                      item.kind === "trip" ? (
                        <div key={item.data.id} data-animate style={{ animationDelay: `${index * 0.08}s` }}>
                          <TripCard trip={item.data} photoCount={item.data.photo_count} />
                        </div>
                      ) : (
                        <div key={item.data.id} data-animate style={{ animationDelay: `${index * 0.08}s` }}>
                          <MilestoneMarker milestone={item.data} />
                        </div>
                      ),
                    )}
                  </div>

                  {yi < sortedYears.length - 1 && <div className="h-4" />}
                </div>
              );
            })}
          </div>
        </div>

        {items.length === 0 && (
          <p className="text-center text-muted py-20 text-base font-sans">
            还没有旅程记录，开始你的第一段旅程吧。
          </p>
        )}
      </section>
    </div>
  );
}
