import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FeatureCollection, GeoJSONFeature } from "@/lib/city-data";

export async function GET() {
  try {
    // Load static pre-fetched boundaries
    const staticPath = path.join(process.cwd(), "public", "data", "city-boundaries.json");
    let staticFeatures: GeoJSONFeature[] = [];
    try {
      const raw = await fs.readFile(staticPath, "utf-8");
      const data: FeatureCollection = JSON.parse(raw);
      staticFeatures = data.features ?? [];
    } catch {
      // static file not found or unreadable — continue with empty
    }

    // Load runtime-added boundaries from Supabase
    let dynamicFeatures: GeoJSONFeature[] = [];
    try {
      const { data, error } = await supabaseAdmin
        .from("city_boundaries")
        .select("name, adcode, geojson");
      if (!error && data) {
        dynamicFeatures = data.map((row) => ({
          type: "Feature",
          geometry: row.geojson,
          properties: { name: row.name, adcode: row.adcode, dynamic: true },
        }));
      }
    } catch {
      // Supabase unavailable or table doesn't exist — continue without dynamic
    }

    const collection: FeatureCollection = {
      type: "FeatureCollection",
      features: [...staticFeatures, ...dynamicFeatures],
    };

    return NextResponse.json(collection, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "无法加载城市边界" }, { status: 500 });
  }
}
