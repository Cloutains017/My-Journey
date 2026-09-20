import test from "node:test";
import assert from "node:assert/strict";
import { stripCitySuffix } from "../src/lib/city-data.ts";
import * as cityData from "../src/lib/city-data.ts";

test("map popup prefers the complete administrative name recorded for a city", () => {
  const trips = [
    { city_name: "福州", location: "福州" },
    { city_name: "福州市", location: "福州" },
    { city_name: "阿坝藏族羌族自治州", location: "阿坝" },
  ];
  assert.ok("getCityDisplayName" in cityData, "maps need a display-name formatter");
  const getCityDisplayName = (cityData as unknown as {
    getCityDisplayName: (cityName: string, records: typeof trips) => string;
  }).getCityDisplayName;
  assert.equal(getCityDisplayName("福州", trips), "福州市");
  assert.equal(getCityDisplayName("阿坝", trips), "阿坝藏族羌族自治州");
});

test("map grouping keeps all five Fuzhou records in one popup group", () => {
  const trips = ["福州市", "福州市", "福州市", "福州市", "福州"].map((city_name, id) => ({ id, city_name, location: "福建省" }));
  assert.ok("groupTripsByCity" in cityData, "maps need a shared canonical city grouping function");
  const group = (cityData as unknown as { groupTripsByCity: (t: typeof trips) => Map<string, typeof trips> }).groupTripsByCity(trips);
  assert.equal(group.size, 1);
  assert.deepEqual(group.get("福州"), trips);
});

test("city grouping treats whitespace and administrative suffix aliases consistently", () => {
  const names = ["福州市", "福州市", "福州市", "福州市", " 福州 "];
  const groups = new Map<string, number>();
  for (const name of names) {
    const key = stripCitySuffix(name);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  assert.deepEqual([...groups], [["福州", 5]]);
  assert.equal(stripCitySuffix("阿坝藏族羌族自治州"), "阿坝");
  assert.notEqual(stripCitySuffix("福州市"), stripCitySuffix("抚州市"));
  assert.notEqual(stripCitySuffix("东京都，日本"), stripCitySuffix("京都府，日本"));
});
