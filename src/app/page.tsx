import { supabase } from "@/lib/supabase";
import HeroMap from "@/components/HeroMap";
import TripCard from "@/components/TripCard";
import MilestoneMarker from "@/components/MilestoneMarker";
import YearNav from "@/components/YearNav";
import { groupTripsByCity } from "@/lib/city-data";
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

  const cityCount = [...groupTripsByCity(tripList).keys()].filter(Boolean).length;
  const latestDate = tripList[0]?.date || "—";

  return (
    <div className="home-journal">
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-8 sm:pt-8">
        <div className="relative isolate overflow-hidden rounded-2xl border border-hairline">
          <HeroMap trips={tripList} />
        </div>
      </div>

      {/* Info section — below map */}
      <div className="mx-auto max-w-5xl px-6 sm:px-8">
        <div className="border-b border-hairline py-9 sm:py-12 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-7 sm:gap-4">
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
      <section className="home-timeline mx-auto max-w-5xl px-6 sm:px-8 pb-24" aria-label="旅程时间线">
        <YearNav years={sortedYears} />
        <div className="min-w-0">
        {/* Section header */}
        <div className="mb-10 pt-8 lg:pt-0">
          <p className="text-xs uppercase tracking-[5px] text-muted-soft mb-6 font-medium font-sans">
            旅 · 程 · 时 · 间 · 线
          </p>
          <h2 className="font-display text-4xl sm:text-5xl font-normal tracking-[-1px] text-ink mb-4">
            来日方长
          </h2>
          <p className="text-sm sm:text-base text-muted leading-relaxed font-sans">
            走过的已成风景，未至的才是远方
          </p>
        </div>

        <div className="relative">

          <div className="flex flex-col gap-10">
            {sortedYears.map((year, yi) => {
              const yearItems = yearGroups.get(year)!;

              return (
                <div key={year} id={`year-${year}`} className="scroll-mt-36 lg:scroll-mt-24">
                  {/* Year divider */}
                  <div className="flex items-center gap-4 mb-6 border-b border-hairline pb-5">
                    <span className="font-display text-4xl font-normal text-primary tracking-[-1px] select-none leading-none tabular-nums">
                      {year}
                    </span>
                    <span className="font-display text-xl font-normal text-primary/30 select-none leading-none mt-1">年</span>
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
        </div>
      </section>
    </div>
  );
}
