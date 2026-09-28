import assert from "node:assert/strict";
import test from "node:test";
import { mapPoint } from "../src/lib/coords.ts";

test("overseas trip coordinates stay unchanged on the map", () => {
  for (const [lat, lng] of [
    [34.693757, 135.501454], // Osaka
    [34.684544, 135.804836], // Nara
    [35.011641, 135.76819], // Kyoto
    [1.3521, 103.8198], // Singapore
  ]) {
    assert.deepEqual(mapPoint(lat, lng, true), { lat, lng });
  }
});

test("domestic coordinates still align to Gaode tiles", () => {
  const point = mapPoint(26.0745, 119.2965, false);
  assert.notDeepEqual(point, { lat: 26.0745, lng: 119.2965 });
});
