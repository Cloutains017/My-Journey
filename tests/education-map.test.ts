import test from "node:test";
import assert from "node:assert/strict";
import { educationRegionKey, educationRegionStyle } from "../src/lib/education-map.ts";

test("education in a trip city keeps the trip region color", () => {
  assert.equal(educationRegionKey({ city_name: "福州市", location: "福州" }), "福州");
  assert.equal(educationRegionStyle("福州", new Set(["福州"])), "marker");
});

test("education without a trip highlights its domestic region", () => {
  assert.equal(educationRegionStyle("厦门", new Set(["福州"])), "region");
});

test("overseas education uses a marker", () => {
  assert.equal(educationRegionKey({ city_name: null, location: "新加坡" }), null);
  assert.equal(educationRegionStyle(null, new Set()), "marker");
});
