import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
type RecordItem = { id: string; kind: "trip" | "education"; title: string; city_name: string | null; location: string; date: string; rating: number | null; slug?: string };
const items: RecordItem[] = [
  { id: "b", kind: "trip", title: "山水与小城", city_name: "福州市", location: "福建省", date: "2025-02-01", rating: 5, slug: "mountains" },
  { id: "a", kind: "trip", title: "Singapore Walk", city_name: null, location: "新加坡", date: "2025-02-01", rating: 3, slug: "singapore" },
  { id: "c", kind: "trip", title: "福州的夜晚", city_name: "福州", location: "福建省福州市", date: "2024-07-01", rating: 3, slug: "night" },
  { id: "d", kind: "education", title: "硕士 · 南洋理工大学", city_name: null, location: "新加坡", date: "2025-08-01", rating: null },
];
async function browsing() {
  const source = await readFile("src/lib/journey-browsing.ts", "utf8").catch(() => "");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} as {
    filterJourneys(items: RecordItem[], filters: { query: string; rating: string }): RecordItem[];
    readJourneyFilters(params: URLSearchParams): { query: string; rating: string };
    adjacentTrips(items: RecordItem[], id: string): { previous: RecordItem | null; next: RecordItem | null };
    withJourneyFilters(href: string, params: URLSearchParams): string;
  } };
  new Function("require", "module", "exports", compiled)(require, compiledModule, compiledModule.exports);
  assert.equal(typeof compiledModule.exports.filterJourneys, "function", "journey filtering must be available");
  return compiledModule.exports;
}

test("journey search combines city/title keywords with rating", async () => {
  const { filterJourneys } = await browsing();
  assert.deepEqual(filterJourneys(items, { query: " 福州  山水 ", rating: "5" }).map(x => x.id), ["b"]);
  assert.deepEqual(filterJourneys(items, { query: "ＳＩＮＧＡＰＯＲＥ", rating: "" }).map(x => x.id), ["a"]);
  assert.deepEqual(filterJourneys(items, { query: "新加坡", rating: "" }).map(x => x.id), ["a", "d"]);
});

test("rating filtering excludes school records and empty searches preserve all records", async () => {
  const { filterJourneys } = await browsing();
  assert.deepEqual(filterJourneys(items, { query: "  ", rating: "" }), items);
  assert.deepEqual(filterJourneys(items, { query: "", rating: "3" }).map(x => x.id), ["a", "c"]);
  assert.deepEqual(filterJourneys(items, { query: "不存在", rating: "" }), []);
});

test("URL filters normalize invalid values while preserving a shareable query", async () => {
  const { readJourneyFilters } = await browsing();
  assert.deepEqual(readJourneyFilters(new URLSearchParams("q=山水&rating=5")), { query: "山水", rating: "5" });
  assert.deepEqual(readJourneyFilters(new URLSearchParams("year=abc&rating=0")), { query: "", rating: "" });
});

test("adjacent trips use date and ID order, skip education, and never mutate input", async () => {
  const { adjacentTrips } = await browsing();
  const original = [...items];
  assert.deepEqual(adjacentTrips(items, "a"), { previous: items[2], next: items[0] });
  assert.deepEqual(adjacentTrips(items, "b"), { previous: items[1], next: null });
  assert.deepEqual(adjacentTrips(items, "c"), { previous: null, next: items[1] });
  assert.deepEqual(items, original);
});

test("missing and single trips do not create self-links", async () => {
  const { adjacentTrips } = await browsing();
  assert.deepEqual(adjacentTrips(items, "missing"), { previous: null, next: null });
  assert.deepEqual(adjacentTrips([items[0]], "b"), { previous: null, next: null });
});

test("journey navigation preserves valid filters, map targets and return anchors", async () => {
  const { withJourneyFilters } = await browsing();
  const params = new URLSearchParams("q=山水&year=2025&rating=5&redirect=https://example.com");
  assert.equal(withJourneyFilters("/trip/mountains", params), "/trip/mountains?q=%E5%B1%B1%E6%B0%B4&rating=5");
  assert.equal(withJourneyFilters("/#journey-explorer", params), "/?q=%E5%B1%B1%E6%B0%B4&rating=5#journey-explorer");
  assert.equal(withJourneyFilters("/map?trip=b", params), "/map?trip=b&q=%E5%B1%B1%E6%B0%B4&rating=5");
  assert.equal(withJourneyFilters("/#journey-explorer", new URLSearchParams("year=bad&rating=0")), "/#journey-explorer");
});
