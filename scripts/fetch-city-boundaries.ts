import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
/**
 * Fetches city boundary GeoJSON from Alibaba DataV API and combines them
 * into a single file for the map component.
 *
 * Usage: npx tsx scripts/fetch-city-boundaries.ts
 */

import fs from "node:fs";
import path from "node:path";
import { dissolveDistricts, buildGeometry } from "../src/lib/geo-utils.ts";
import { CITY_ADCODE_MAP } from "../src/lib/city-adcodes.ts";

// ---------------------------------------------------------------------------
// Pre-fetch only the most common travel destinations (~60 cities).
// Other cities are fetched on-demand via the admin API and stored in Supabase.
// ---------------------------------------------------------------------------
const PRE_FETCH_CITIES: string[] = [
  "北京", "上海", "天津", "重庆",
  "杭州", "宁波", "温州", "嘉兴", "绍兴", "湖州", "金华", "台州", "舟山", "丽水", "衢州",
  "南京", "苏州", "无锡", "常州", "扬州", "镇江", "徐州", "南通",
  "广州", "深圳", "珠海", "佛山", "东莞", "惠州",
  "成都", "绵阳", "乐山",
  "武汉", "宜昌",
  "长沙", "张家界", "岳阳",
  "西安", "咸阳",
  "厦门", "福州", "泉州", "平潭",
  "青岛", "济南", "烟台", "威海",
  "大连", "沈阳",
  "昆明", "大理", "丽江", "西双版纳",
  "贵阳", "遵义", "安顺",
  "阿坝", "甘孜", "凉山", "湘西", "恩施", "延边",
  "神农架",
  "桂林", "南宁", "北海",
  "拉萨", "日喀则",
  "三亚", "海口",
  "哈尔滨",
  "郑州", "洛阳", "开封",
  "合肥", "黄山",
  "南昌", "九江",
  "太原", "大同",
  "兰州", "嘉峪关", "敦煌",
  "呼和浩特", "呼伦贝尔",
  "乌鲁木齐", "喀什",
  "西宁", "银川",
];

const DATA_DIR = path.join(import.meta.dirname, "..", "public", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "city-boundaries.json");

// ---------------------------------------------------------------------------
// Simple Douglas-Peucker coordinate simplification
// ---------------------------------------------------------------------------
function perpendicularDist(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number],
): number {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const d = Math.sqrt(
      (point[0] - lineStart[0]) ** 2 + (point[1] - lineStart[1]) ** 2,
    );
    return d;
  }
  const t =
    ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lenSq;
  const clamped = Math.max(0, Math.min(1, t));
  const projX = lineStart[0] + clamped * dx;
  const projY = lineStart[1] + clamped * dy;
  return Math.sqrt((point[0] - projX) ** 2 + (point[1] - projY) ** 2);
}

function simplifyRing(
  ring: number[][],
  tolerance: number,
  minPoints = 8,
): number[][] {
  if (ring.length <= minPoints) return ring;

  let maxDist = 0;
  let maxIdx = 0;
  const first = ring[0];
  const last = ring[ring.length - 1];

  for (let i = 1; i < ring.length - 1; i++) {
    const dist = perpendicularDist(
      ring[i] as [number, number],
      first as [number, number],
      last as [number, number],
    );
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyRing(ring.slice(0, maxIdx + 1), tolerance, minPoints);
    const right = simplifyRing(ring.slice(maxIdx), tolerance, minPoints);
    return [...left.slice(0, -1), ...right];
  }

  // If simplified result is too sparse, re-simplify with lower tolerance
  if (ring.length > minPoints && tolerance > 0.001) {
    return simplifyRing(ring, tolerance / 3, minPoints);
  }

  return [first, last];
}

function simplifyGeometry(geometry: Polygon | MultiPolygon, tolerance: number): Polygon | MultiPolygon {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((ring: number[][]) =>
        simplifyRing(ring, tolerance),
      ),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((polygon: number[][][]) =>
        polygon.map((ring) => simplifyRing(ring, tolerance)),
      ),
    };
  }
  return geometry;
}

// ---------------------------------------------------------------------------
// Merge multiple district features into a single geometry using dissolve,
// which dissolves internal boundaries between adjacent polygons.
// ---------------------------------------------------------------------------
function unionFeatures(features: Feature<Polygon | MultiPolygon>[]): Polygon | MultiPolygon {
  const coords = dissolveDistricts(features);
  return buildGeometry(coords);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const features: Feature<Polygon | MultiPolygon>[] = [];
  const tolerance = 0.006; // ~600m at equator, good balance for city-level zoom

  for (const name of PRE_FETCH_CITIES) {
    const adcode = CITY_ADCODE_MAP[name];
    if (!adcode) {
      console.error(`  Skipping ${name}: no adcode in mapping`);
      continue;
    }
    console.log(`Fetching ${name} (${adcode})...`);

    // Try _full first (for prefecture-level cities), fall back to bare adcode (for county-level units)
    let geo: FeatureCollection<Polygon | MultiPolygon>;
    let url = `https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=${adcode}_full`;
    let res = await fetch(url);
    if (!res.ok) {
      url = `https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=${adcode}`;
      res = await fetch(url);
    }
    if (!res.ok) {
      console.error(`  Failed: HTTP ${res.status}`);
      continue;
    }
    try {
      geo = await res.json();
    } catch {
      console.error(`  Invalid JSON response`);
      continue;
    }
    const districtFeatures = geo.features;
    if (!districtFeatures || districtFeatures.length === 0) {
      console.error(`  No features in response`);
      continue;
    }

    // Compute geometric union to dissolve internal district boundaries
    try {
      const unified = unionFeatures(districtFeatures);
      const simplified = simplifyGeometry(unified, tolerance);

      const feature: Feature<Polygon | MultiPolygon> = {
        type: "Feature",
        geometry: simplified,
        properties: {
          name,
          adcode,
          districtCount: districtFeatures.length,
        },
      };

      features.push(feature);
      console.log(`  OK — ${districtFeatures.length} districts → union (${unified.type}), ${JSON.stringify(simplified).length} chars`);
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const collection = {
    type: "FeatureCollection",
    features,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(collection), "utf-8");
  console.log(`\nWritten ${features.length} city boundaries to ${OUTPUT_FILE}`);
  console.log(`Total size: ${(JSON.stringify(collection).length / 1024).toFixed(1)} KB`);
}

main();
