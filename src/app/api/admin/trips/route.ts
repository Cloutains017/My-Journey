import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";
import { checkAuth } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";
import { lookupAdcode } from "@/lib/city-adcodes";
import { dissolveDistricts, buildGeometry } from "@/lib/geo-utils";


function generateSlug(title: string, date?: string): string {
  const ascii = title
    .replace(/[^\x00-\x7F]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  if (ascii.length >= 2) return ascii;
  if (date) return `trip-${date}`;
  return `trip-${Date.now()}`;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let counter = 2;
  while (true) {
    const { data } = await supabaseAdmin
      .from("trips")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${base}-${counter}`;
    counter++;
  }
}

/**
 * Auto-add city boundary for a newly created trip.
 * Runs in background — failure does not block trip creation.
 */
async function ensureCityBoundary(cityName: string) {
  try {
    const adcode = lookupAdcode(cityName);
    if (!adcode) return;

    // Check if boundary already exists in Supabase
    const { data: existingInDb } = await supabaseAdmin
      .from("city_boundaries")
      .select("name")
      .eq("name", cityName)
      .single();
    if (existingInDb) return;

    // Check static file (dynamic import for ESM compatibility)
    try {
      const { promises: fs } = await import("node:fs");
      const { join } = await import("node:path");
      const staticPath = join(process.cwd(), "public", "data", "city-boundaries.json");
      const raw = await fs.readFile(staticPath, "utf-8");
      const data: { features?: { properties?: { name?: string } }[] } = JSON.parse(raw);
      if (data.features?.some((f) => f.properties?.name === cityName)) return;
    } catch { /* static file might not exist */ }

    // Fetch from DataV (_full for prefecture, bare for county-level)
    let url = `https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=${adcode}_full`;
    let res = await fetch(url);
    if (!res.ok) {
      url = `https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=${adcode}`;
      res = await fetch(url);
    }
    if (!res.ok) return;
    const geo = await res.json();
    const features = geo.features;
    if (!features || features.length === 0) return;

    // Dissolve to remove internal district boundaries
    const geometry = buildGeometry(dissolveDistricts(features));

    // Store in Supabase
    await supabaseAdmin.from("city_boundaries").insert({
      name: cityName,
      adcode,
      geojson: geometry,
    });
  } catch {
    // Best-effort: don't block trip creation
  }
}

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("trips")
    .select("*")
    .order("date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (!(await checkAuth())) return NextResponse.json({ error: "未授权" }, { status: 401 });
  const body = await request.json();
  const { title, slug: customSlug, date, end_date, location, city_name, latitude, longitude, cover_image, content, rating } = body;
  const baseSlug = customSlug || generateSlug(title || "", date);
  const slug = await uniqueSlug(baseSlug);
  const { data, error } = await supabaseAdmin.from("trips").insert({
    title, slug, date, end_date: end_date || null, location, city_name: city_name || null, latitude, longitude, cover_image: cover_image || null, content, rating
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-add city boundary (non-blocking, best-effort)
  if (city_name) ensureCityBoundary(city_name);

  revalidatePath("/");
  revalidatePath(`/trip/${slug}`);
  return NextResponse.json(data);
}
