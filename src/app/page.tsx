import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { connection } from "next/server";
import HeroMap from "@/components/HeroMap";
import TripCard from "@/components/TripCard";
import EducationCard from "@/components/EducationCard";
import JourneyExplorer, { type JourneyItem } from "@/components/JourneyExplorer";
import { groupTripsByCity } from "@/lib/city-data";
import type { Trip, Education } from "@/lib/types";
import { DEFAULT_EDUCATION } from "@/lib/education";

const getTrips = unstable_cache(
  async () => {
    const { data, error } = await supabase.from("trips").select("*, photos(count)").order("date", { ascending: false });
    if (error) throw new Error("暂时无法加载旅程，请稍后重试");
    return data || [];
  },
  ["home-trips"],
  { revalidate: 3600 },
);

const getEducation = unstable_cache(async (): Promise<Education[]> => {
  const { data, error } = await supabase.from("education").select("*").order("date", { ascending: false });
  if (error) return DEFAULT_EDUCATION;
  return data as Education[];
}, ["home-education"], { revalidate: 3600 });

export default async function HomePage() {
  await connection();
  const [trips, education] = await Promise.all([getTrips(), getEducation()]);
  const tripList = trips.map((row) => {
    const { photos, ...trip } = row as Omit<Trip, "photos"> & { photos: { count: number }[] };
    return { ...trip, photo_count: photos[0]?.count ?? 0 };
  });

  // Keep card rendering on the server; send only searchable metadata to the explorer.
  const items: JourneyItem[] = [
    ...tripList.map(trip => ({ kind: "trip" as const, id: trip.id, title: trip.title, date: trip.date,
      city_name: trip.city_name, location: trip.location, rating: trip.rating,
      content: <TripCard trip={trip} photoCount={trip.photo_count} /> })),
    ...education.map(record => ({ kind: "education" as const, id: record.id, title: `${record.degree} · ${record.school}`, date: record.date,
      city_name: record.city_name, location: record.location, rating: null,
      content: <EducationCard education={record} /> })),
  ];
  items.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  const cityCount = [...groupTripsByCity(tripList).keys()].filter(Boolean).length;
  const latestDate = tripList[0]?.date || "—";

  return (
    <div className="home-journal">
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-8 sm:pt-8">
        <div className="relative isolate overflow-hidden rounded-2xl border border-hairline">
          <HeroMap trips={tripList} education={education} />
        </div>
      </div>

      {/* Info section — below map */}
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="home-summary border-b border-hairline">
          <div className="home-intro">
            <p className="text-[11px] uppercase tracking-[4px] text-muted-soft mb-2 font-medium font-sans">
              Where I&apos;ve Been
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-normal tracking-[-0.5px] text-ink">
              Cloutains <span className="text-muted-display font-light">的旅程</span>
            </h1>
            <p className="text-xs text-muted mt-1.5 tracking-wider font-sans">
              用脚步丈量世界
            </p>
          </div>

          <div className="home-stats">
            <div className="home-stat">
              <span className="home-stat-value text-ink">{tripList.length}</span>
              <span className="home-stat-label">段旅程</span>
            </div>
            <div className="home-stat">
              <span className="home-stat-value text-primary">{cityCount || "—"}</span>
              <span className="home-stat-label">座城市</span>
            </div>
            <div className="home-stat home-stat-latest">
              <span className="home-stat-value home-stat-date text-ink">{latestDate || "—"}</span>
              <span className="home-stat-label">最近记录</span>
            </div>
          </div>
        </div>
      </div>

      <JourneyExplorer items={items} />
    </div>
  );
}
