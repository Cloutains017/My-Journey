import test from "node:test";
import assert from "node:assert/strict";
import { groupMapRecords, EDUCATION_COLOR } from "../src/lib/education-map.ts";

test("domestic education and trips share one rated region", () => {
  const trips = [
    { city_name: "福州市", location: "福建省福州市", rating: 4 },
    { city_name: "福州", location: "福州", rating: 2 },
  ];
  const education = [{ city_name: "福州市", location: "福州市", school: "福州大学" }];
  const regions = groupMapRecords(trips, education);
  assert.equal(regions.size, 1);
  assert.deepEqual(regions.get("福州"), {
    trips,
    education,
    domestic: true,
    color: "#66bb6a",
  });
});

test("education-only domestic city uses a highlighted region", () => {
  const school = { city_name: "厦门市", location: "厦门市", school: "厦门外国语学校" };
  const regions = groupMapRecords([], [school]);
  assert.deepEqual(regions.get("厦门"), {
    trips: [],
    education: [school],
    domestic: true,
    color: EDUCATION_COLOR,
  });
});

test("Singapore trip and education share one overseas point and trip rating", () => {
  const trip = { city_name: null, location: "新加坡", rating: 5 };
  const school = { city_name: null, location: "新加坡", school: "南洋理工大学" };
  const regions = groupMapRecords([trip], [school]);
  assert.deepEqual(regions.get("新加坡"), {
    trips: [trip],
    education: [school],
    domestic: false,
    color: "#ff6b6b",
  });
});
