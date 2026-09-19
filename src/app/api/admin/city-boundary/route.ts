import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { lookupAdcode } from "@/lib/city-adcodes";
import { dissolveDistricts, buildGeometry } from "@/lib/geo-utils";
import { checkAuth } from "@/lib/admin-auth";


/**
 * Fetch and merge all district boundaries for a given adcode from DataV.
 */
async function fetchCityBoundary(adcode: string) {
  let url = `https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=${adcode}_full`;
  let res = await fetch(url);
  if (!res.ok) {
    url = `https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=${adcode}`;
    res = await fetch(url);
  }
  if (!res.ok) throw new Error(`DataV API returned HTTP ${res.status}`);
  const geo = await res.json();
  const features = geo.features;
  if (!features || features.length === 0) throw new Error("No boundary data found");

  // Dissolve all district features to remove internal boundaries
  const geometry = buildGeometry(dissolveDistricts(features));
  return geometry;
}

export async function POST(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { cityName } = body;
    let { adcode } = body;

    if (!cityName) {
      return NextResponse.json({ error: "cityName is required" }, { status: 400 });
    }

    // Resolve adcode if not provided
    if (!adcode) {
      adcode = lookupAdcode(cityName);
      if (!adcode) {
        return NextResponse.json(
          { error: `无法找到城市"${cityName}"的行政区划代码，请手动提供adcode` },
          { status: 400 },
        );
      }
    }

    // Check if already exists
    const { data: existing } = await supabaseAdmin
      .from("city_boundaries")
      .select("name")
      .eq("name", cityName)
      .single();

    if (existing) {
      return NextResponse.json({ message: "已存在", feature: existing });
    }

    // Fetch and merge boundary
    const geometry = await fetchCityBoundary(adcode);

    // Store in Supabase
    const { error } = await supabaseAdmin
      .from("city_boundaries")
      .insert({
        name: cityName,
        adcode,
        geojson: geometry,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      success: true,
      feature: {
        type: "Feature",
        geometry,
        properties: { name: cityName, adcode, dynamic: true },
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "无法保存城市边界" }, { status: 500 });
  }
}
